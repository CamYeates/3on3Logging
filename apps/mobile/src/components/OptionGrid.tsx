import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { FlowOption } from '../flow/types';
import { BigButton } from './BigButton';
import { colors, spacing } from '../theme';

interface OptionGridProps {
  options: FlowOption[];
  onSelect: (value: string | number) => void;
}

/** Grid of large option buttons (point values, made/missed, foul type, …). */
export function OptionGrid({ options, onSelect }: OptionGridProps) {
  return (
    <View style={styles.wrap}>
      {options.map((opt) => (
        <View key={String(opt.value)} style={styles.cell}>
          <BigButton
            label={opt.label}
            color={opt.color ?? colors.primary}
            onPress={() => onSelect(opt.value)}
            testID={`option-${opt.value}`}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { width: '31%', minWidth: 180 },
});
