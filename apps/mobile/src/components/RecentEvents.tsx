import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionType, type GameEvent, type GamePlayer } from '@3on3/shared';
import { colors, font, radius, spacing } from '../theme';

interface RecentEventsProps {
  /** Already filtered to active + newest-first, max 5. */
  events: GameEvent[];
  players: GamePlayer[];
}

const ACTION_LABELS: Record<string, string> = {
  [ActionType.MADE_SHOT]: 'Score',
  [ActionType.MISSED_SHOT]: 'Miss',
  [ActionType.REBOUND]: 'Rebound',
  [ActionType.ASSIST]: 'Assist',
  [ActionType.STEAL]: 'Steal',
  [ActionType.BLOCK]: 'Block',
  [ActionType.TURNOVER]: 'Turnover',
  [ActionType.FOUL]: 'Foul',
  [ActionType.FREE_THROW]: 'Free Throw',
  [ActionType.SUBSTITUTION]: 'Sub',
  [ActionType.TIMEOUT]: 'Timeout',
};

/** Compact, read-only log of the most recent events (max 5). */
export function RecentEvents({ events, players }: RecentEventsProps) {
  const nameFor = (playerId: string | null) =>
    players.find((p) => p.playerId === playerId)?.name ?? '';

  const describe = (e: GameEvent): string => {
    const label = ACTION_LABELS[e.actionType] ?? e.actionType;
    const who = nameFor(e.playerId);
    const detail: string[] = [];
    if (e.pointValue && e.actionType === ActionType.MADE_SHOT)
      detail.push(`${e.pointValue}pt`);
    if (e.result) detail.push(e.result);
    if (e.relatedPlayerId && e.actionType === ActionType.MADE_SHOT)
      detail.push(`ast ${nameFor(e.relatedPlayerId)}`);
    return `${label}${who ? ` — ${who}` : ''}${
      detail.length ? ` (${detail.join(', ')})` : ''
    }`;
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Recent</Text>
      {events.length === 0 ? (
        <Text style={styles.empty}>No events yet</Text>
      ) : (
        events.map((e) => (
          <View key={e.id} style={styles.row}>
            <Text style={styles.seq}>#{e.sequenceNumber}</Text>
            <Text style={styles.desc} numberOfLines={1}>
              {describe(e)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  heading: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  empty: { color: colors.textMuted, fontSize: font.body },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  seq: { color: colors.textMuted, fontSize: font.small, width: 36 },
  desc: { color: colors.text, fontSize: font.body, flex: 1 },
});
