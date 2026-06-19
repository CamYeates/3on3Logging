import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { GamePlayer } from '@3on3/shared';
import { BigButton } from './BigButton';
import { colors, font, spacing } from '../theme';

interface PlayerGridProps {
  players: GamePlayer[];
  teamColors: Record<string, string>;
  onSelect: (playerId: string) => void;
  /** Optional "None" option (e.g. "No Assist"). */
  noneLabel?: string;
  onNone?: () => void;
}

/**
 * Grid of large player buttons. Color-coded by team so the logger can find a
 * player instantly. Players are grouped: team A first, then team B.
 */
export function PlayerGrid({
  players,
  teamColors,
  onSelect,
  noneLabel,
  onNone,
}: PlayerGridProps) {
  return (
    <View style={styles.wrap}>
      {players.map((p) => (
        <View key={p.playerId} style={styles.cell}>
          <BigButton
            label={p.jerseyNumber ? `#${p.jerseyNumber}  ${p.name}` : p.name}
            color={teamColors[p.teamId] ?? colors.surfaceAlt}
            onPress={() => onSelect(p.playerId)}
            testID={`player-${p.playerId}`}
          />
        </View>
      ))}
      {noneLabel && onNone ? (
        <View style={styles.cell}>
          <BigButton label={noneLabel} color={colors.surface} onPress={onNone} />
        </View>
      ) : null}
      {players.length === 0 && !noneLabel ? (
        <Text style={styles.empty}>No active players</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  // Roughly 3 across on iPad landscape.
  cell: { width: '31%', minWidth: 180 },
  empty: { color: colors.textMuted, fontSize: font.body, padding: spacing.md },
});
