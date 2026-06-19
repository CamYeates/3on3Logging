import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';
import { TOUCH_TARGET, colors, font, radius, spacing } from '../theme';

interface BigButtonProps {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  /** Smaller variant for secondary actions. */
  small?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/** Large, high-contrast touch target tuned for fast iPad tapping. */
export function BigButton({
  label,
  onPress,
  color = colors.surfaceAlt,
  disabled,
  loading,
  small,
  style,
  testID,
}: BigButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: color, minHeight: small ? 56 : TOUCH_TARGET },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryText} />
      ) : (
        <Text style={[styles.label, { fontSize: small ? font.body : font.large }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  label: {
    color: colors.primaryText,
    fontWeight: '700',
    textAlign: 'center',
  },
});
