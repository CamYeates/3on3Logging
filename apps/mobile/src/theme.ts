/**
 * Clean, neutral design tokens. iPad-landscape first: large touch targets,
 * minimal chrome, high contrast. No animations.
 */
export const colors = {
  bg: '#0f172a', // slate-900
  surface: '#1e293b', // slate-800
  surfaceAlt: '#334155', // slate-700
  border: '#475569', // slate-600
  text: '#f8fafc', // slate-50
  textMuted: '#94a3b8', // slate-400
  primary: '#2563eb', // blue-600
  primaryText: '#ffffff',
  success: '#16a34a', // green-600
  danger: '#dc2626', // red-600
  warning: '#d97706', // amber-600
  teamA: '#dc2626', // red
  teamB: '#2563eb', // blue
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
};

/** Minimum touch target for iPad logging buttons. */
export const TOUCH_TARGET = 88;

export const font = {
  small: 14,
  body: 18,
  large: 24,
  title: 32,
  huge: 48,
};
