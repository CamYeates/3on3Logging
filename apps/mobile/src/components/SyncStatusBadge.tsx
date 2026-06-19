import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isSupabaseConfigured } from '../supabase/client';
import { colors, font, radius, spacing } from '../theme';

interface SyncStatusBadgeProps {
  pending: number;
  syncing: boolean;
}

/** Compact sync indicator: synced / pending count / syncing / offline. */
export function SyncStatusBadge({ pending, syncing }: SyncStatusBadgeProps) {
  let label: string;
  let color: string;

  if (!isSupabaseConfigured()) {
    label = 'Offline only';
    color = colors.textMuted;
  } else if (syncing) {
    label = 'Syncing…';
    color = colors.warning;
  } else if (pending > 0) {
    label = `${pending} pending`;
    color = colors.warning;
  } else {
    label = 'Synced';
    color = colors.success;
  }

  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: font.small, fontWeight: '600' },
});
