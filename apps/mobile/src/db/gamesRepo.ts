import {
  GameStatus,
  type CreateGameInput,
  type Game,
  type GamePlayer,
  type PlayerInput,
} from '@3on3/shared';
import { newUuid } from '../lib/ids';
import { getDb } from './database';
import {
  rowToGame,
  rowToGamePlayer,
  type GamePlayerRow,
  type GameRow,
} from './mappers';
import { queueForSync } from './syncQueueRepo';

const nowIso = () => new Date().toISOString();

/** Create a new local game and enqueue it for sync. Returns the new game. */
export async function createGame(input: CreateGameInput): Promise<Game> {
  const db = await getDb();
  const id = newUuid();
  const teamAId = newUuid();
  const teamBId = newUuid();
  const now = nowIso();

  await db.runAsync(
    `INSERT INTO local_games
       (id, organization_id, name, location, game_date, team_a_id, team_b_id,
        team_a_name, team_b_name, scoring_mode, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      null,
      input.name,
      input.location ?? null,
      input.gameDate,
      teamAId,
      teamBId,
      input.teamAName,
      input.teamBName,
      input.scoringMode,
      GameStatus.SETUP,
      now,
      now,
    ],
  );

  await queueForSync('game', id);
  return getGame(id) as Promise<Game>;
}

export async function listGames(): Promise<Game[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<GameRow>(
    'SELECT * FROM local_games ORDER BY game_date DESC, created_at DESC',
  );
  return rows.map(rowToGame);
}

export async function getGame(id: string): Promise<Game | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<GameRow>(
    'SELECT * FROM local_games WHERE id = ?',
    [id],
  );
  return row ? rowToGame(row) : null;
}

export async function updateGameStatus(
  id: string,
  status: Game['status'],
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE local_games SET status = ?, updated_at = ? WHERE id = ?',
    [status, nowIso(), id],
  );
  await queueForSync('game', id);
}

/** Replace the roster for one team of a game. */
export async function setRoster(
  gameId: string,
  teamId: string,
  players: PlayerInput[],
): Promise<void> {
  const db = await getDb();
  const now = nowIso();

  await db.withTransactionAsync(async () => {
    // Clear existing roster + player rows for this team in this game.
    await db.runAsync(
      'DELETE FROM local_game_players WHERE game_id = ? AND team_id = ?',
      [gameId, teamId],
    );

    for (const p of players) {
      const playerId = newUuid();
      const gpId = newUuid();
      await db.runAsync(
        `INSERT OR REPLACE INTO local_players (id, team_id, name, jersey_number, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [playerId, teamId, p.name, p.jerseyNumber ?? null, now],
      );
      await db.runAsync(
        `INSERT INTO local_game_players
           (id, game_id, player_id, team_id, name, jersey_number, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          gpId,
          gameId,
          playerId,
          teamId,
          p.name,
          p.jerseyNumber ?? null,
          p.active ? 1 : 0,
          now,
        ],
      );
      await queueForSync('game_player', gpId);
    }
  });
}

export async function getGamePlayers(gameId: string): Promise<GamePlayer[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<GamePlayerRow>(
    'SELECT * FROM local_game_players WHERE game_id = ? ORDER BY team_id, created_at',
    [gameId],
  );
  return rows.map(rowToGamePlayer);
}

/** Toggle a roster player's active flag. */
export async function setPlayerActive(
  gamePlayerId: string,
  active: boolean,
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE local_game_players SET active = ? WHERE id = ?', [
    active ? 1 : 0,
    gamePlayerId,
  ]);
}

/** Map of playerId -> teamId for a game (used by team-stat calculations). */
export async function getPlayerTeamMap(
  gameId: string,
): Promise<Record<string, string>> {
  const players = await getGamePlayers(gameId);
  const map: Record<string, string> = {};
  for (const p of players) map[p.playerId] = p.teamId;
  return map;
}
