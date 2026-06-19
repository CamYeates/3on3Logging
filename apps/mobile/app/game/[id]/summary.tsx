import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import {
  ActionType,
  GameStatus,
  calculatePlayerStats,
  calculateTeamStats,
  getActiveEvents,
  type Game,
  type GameEvent,
  type GamePlayer,
  type PlayerStatLine,
} from '@3on3/shared';
import { BigButton } from '../../../src/components/BigButton';
import { getEventsForGame } from '../../../src/db/eventsRepo';
import { getGame, getGamePlayers, getPlayerTeamMap, updateGameStatus } from '../../../src/db/gamesRepo';
import { pushGameToCloud } from '../../../src/sync/syncService';
import { colors, font, radius, spacing } from '../../../src/theme';

/** Game summary: box score, team totals, timeline, export + sync. */
export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [playerTeamMap, setPlayerTeamMap] = useState<Record<string, string>>({});
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const [g, p, e, m] = await Promise.all([
        getGame(id),
        getGamePlayers(id),
        getEventsForGame(id),
        getPlayerTeamMap(id),
      ]);
      setGame(g);
      setPlayers(p);
      setEvents(e);
      setPlayerTeamMap(m);
    })();
  }, [id]);

  const playerStats = useMemo(() => calculatePlayerStats(events), [events]);
  const teamStats = useMemo(
    () => calculateTeamStats(events, playerTeamMap),
    [events, playerTeamMap],
  );
  const timeline = useMemo(() => getActiveEvents(events), [events]);

  const onExport = async () => {
    if (!game) return;
    const payload = {
      game,
      players,
      events,
      derived: { playerStats, teamStats },
      exportedAt: new Date().toISOString(),
    };
    await Share.share({ message: JSON.stringify(payload, null, 2) });
  };

  const onSync = async () => {
    if (!game) return;
    setSyncing(true);
    try {
      if (game.status === GameStatus.ACTIVE) {
        await updateGameStatus(game.id, GameStatus.COMPLETED);
      }
      const res = await pushGameToCloud(game.id);
      setSyncMsg(res.message);
    } finally {
      setSyncing(false);
    }
  };

  if (!game) return null;

  const teamPlayers = (teamId: string) => players.filter((p) => p.teamId === teamId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.actions}>
        <BigButton label="Export JSON" small color={colors.surfaceAlt} onPress={onExport} />
        <BigButton label="Sync Now" small color={colors.primary} onPress={onSync} loading={syncing} />
      </View>
      {syncMsg ? <Text style={styles.syncMsg}>{syncMsg}</Text> : null}

      <TeamSection
        title={game.teamAName}
        accent={colors.teamA}
        score={teamStats[game.teamAId]?.points ?? 0}
        players={teamPlayers(game.teamAId)}
        stats={playerStats}
      />
      <TeamSection
        title={game.teamBName}
        accent={colors.teamB}
        score={teamStats[game.teamBId]?.points ?? 0}
        players={teamPlayers(game.teamBId)}
        stats={playerStats}
      />

      <Text style={styles.sectionTitle}>Event Timeline</Text>
      <View style={styles.timeline}>
        {timeline.map((e) => (
          <Text key={e.id} style={styles.timelineRow}>
            #{e.sequenceNumber} · {labelFor(e, players)}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const COLS: { key: keyof PlayerStatLine; label: string }[] = [
  { key: 'points', label: 'PTS' },
  { key: 'fieldGoalsMade', label: 'FGM' },
  { key: 'fieldGoalsAttempted', label: 'FGA' },
  { key: 'freeThrowsMade', label: 'FTM' },
  { key: 'freeThrowsAttempted', label: 'FTA' },
  { key: 'assists', label: 'AST' },
  { key: 'rebounds', label: 'REB' },
  { key: 'steals', label: 'STL' },
  { key: 'blocks', label: 'BLK' },
  { key: 'turnovers', label: 'TO' },
  { key: 'fouls', label: 'PF' },
];

function TeamSection({
  title,
  accent,
  score,
  players,
  stats,
}: {
  title: string;
  accent: string;
  score: number;
  players: GamePlayer[];
  stats: Record<string, PlayerStatLine>;
}) {
  return (
    <View style={styles.teamSection}>
      <View style={styles.teamHeader}>
        <Text style={[styles.teamTitle, { color: accent }]}>{title}</Text>
        <Text style={[styles.teamScore, { color: accent }]}>{score}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          {/* Header row */}
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.nameCell, styles.headerText]}>Player</Text>
            {COLS.map((c) => (
              <Text key={c.key} style={[styles.statCell, styles.headerText]}>
                {c.label}
              </Text>
            ))}
          </View>
          {players.map((p) => {
            const line = stats[p.playerId];
            return (
              <View key={p.playerId} style={styles.row}>
                <Text style={styles.nameCell} numberOfLines={1}>
                  {p.jerseyNumber ? `#${p.jerseyNumber} ` : ''}
                  {p.name}
                </Text>
                {COLS.map((c) => (
                  <Text key={c.key} style={styles.statCell}>
                    {line ? String(line[c.key]) : '0'}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function labelFor(e: GameEvent, players: GamePlayer[]): string {
  const who = players.find((p) => p.playerId === e.playerId)?.name ?? '';
  const parts = [e.actionType.replace('_', ' ')];
  if (who) parts.push(who);
  if (e.pointValue && e.actionType === ActionType.MADE_SHOT) parts.push(`${e.pointValue}pt`);
  if (e.result) parts.push(String(e.result));
  return parts.join(' · ');
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md },
  syncMsg: { color: colors.textMuted, fontSize: font.body },
  teamSection: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  teamHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teamTitle: { fontSize: font.large, fontWeight: '800' },
  teamScore: { fontSize: font.title, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  headerRow: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  headerText: { color: colors.textMuted, fontWeight: '700' },
  nameCell: { width: 160, color: colors.text, fontSize: font.body },
  statCell: { width: 56, textAlign: 'center', color: colors.text, fontSize: font.body },
  sectionTitle: { color: colors.text, fontSize: font.large, fontWeight: '700' },
  timeline: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  timelineRow: { color: colors.textMuted, fontSize: font.small },
});
