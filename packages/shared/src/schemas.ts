import { z } from 'zod';
import {
  ALL_ACTION_TYPES,
  ActionType,
  FoulType,
  GameStatus,
  ScoringMode,
} from './enums';

/**
 * Zod validation schemas. Used to validate user input at game/roster creation
 * time and to validate event payloads before they are written to the local DB.
 */

export const scoringModeSchema = z.enum([
  ScoringMode.STANDARD,
  ScoringMode.THREE_X_THREE,
]);

export const gameStatusSchema = z.enum([
  GameStatus.SETUP,
  GameStatus.ACTIVE,
  GameStatus.COMPLETED,
  GameStatus.ARCHIVED,
]);

export const actionTypeSchema = z.enum(
  ALL_ACTION_TYPES as [string, ...string[]],
);

export const foulTypeSchema = z.enum([
  FoulType.PERSONAL,
  FoulType.SHOOTING,
  FoulType.OFFENSIVE,
  FoulType.TECHNICAL,
]);

export const createGameSchema = z.object({
  name: z.string().trim().min(1, 'Game name is required'),
  location: z.string().trim().optional().nullable(),
  gameDate: z.string().min(1, 'Game date is required'),
  teamAName: z.string().trim().min(1, 'Team A name is required'),
  teamBName: z.string().trim().min(1, 'Team B name is required'),
  scoringMode: scoringModeSchema,
});

export type CreateGameInput = z.infer<typeof createGameSchema>;

export const playerInputSchema = z.object({
  name: z.string().trim().min(1, 'Player name is required'),
  jerseyNumber: z.string().trim().optional().nullable(),
  active: z.boolean().default(true),
});

export type PlayerInput = z.infer<typeof playerInputSchema>;

/** A roster must have at least 3 players per team for 3-on-3. */
export const rosterSchema = z
  .array(playerInputSchema)
  .min(3, 'At least 3 players are required per team');

export const eventMetadataSchema = z
  .object({
    foulType: foulTypeSchema.optional(),
    playerOutId: z.string().uuid().optional(),
    playerInId: z.string().uuid().optional(),
  })
  .passthrough();

/** Validates an event payload prior to persisting it locally. */
export const newGameEventSchema = z.object({
  gameId: z.string().uuid(),
  clientEventId: z.string().uuid(),
  deviceId: z.string().min(1),
  teamId: z.string().uuid().nullable(),
  playerId: z.string().uuid().nullable(),
  relatedPlayerId: z.string().uuid().nullable(),
  actionType: actionTypeSchema,
  pointValue: z.number().int().nullable(),
  result: z.string().nullable(),
  metadata: eventMetadataSchema.default({}),
  createdBy: z.string().uuid().nullable(),
  undoOfEventId: z.string().uuid().nullable(),
  localCreatedAt: z.string().optional(),
});
