import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Game } from '@3on3/shared';
import { SyncStatusBadge } from './SyncStatusBadge';
import { colors, font, spacing } from '../theme';

interface ScoreBarProps {
  game: Game;
  scoreA: number;
  scoreB: number;
  pendingSync: number;
  syncing: boolean;
}

/** Top bar: game name, live score (derived), and sync status. */
export function ScoreBar({ game, scoreA, scoreB, pendingSync, syncing }: ScoreBarProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        <Text style={styles.teamName} numberOfLines={1}>
          {game.teamAName}
        </Text>
        <Text style={[styles.score, { color: colors.teamA }]}>{scoreA}</Text>
      </View>

      <View style={styles.center}>
        <Text style={styles.gameName} numberOfLines={1}>
          {game.name}
        </Text>
        <SyncStatusBadge pending={pendingSync} syncing={syncing} />
      </View>

      <View style={styles.side}>
        <Text style={[styles.score, { color: colors.teamB }]}>{scoreB}</Text>
        <Text style={styles.teamName} numberOfLines={1}>
          {game.teamBName}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  side: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  center: { alignItems: 'center', gap: spacing.xs },
  teamName: { color: colors.text, fontSize: font.body, fontWeight: '600', maxWidth: 200 },
  gameName: { color: colors.textMuted, fontSize: font.small },
  score: { fontSize: font.huge, fontWeight: '800' },
});
