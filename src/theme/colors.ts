// Survivor-themed dark mode color palette
export const colors = {
  // Brand — torch red
  primary: '#C4402F',
  primaryDark: '#8B2D1F',
  primaryLight: '#E8A090',

  // Tribe colors
  vatu: '#2E7D32',    // forest green
  cila: '#1565C0',    // ocean blue
  kalo: '#F57F17',    // warm amber

  // Backgrounds
  background: '#0A0A0A',
  surface: '#1A1A1A',
  surfaceElevated: '#242424',
  border: '#333333',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#606060',

  // Feedback
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  pending: '#9E9E9E',

  // Score display
  scorePositive: '#4CAF50',
  scoreNegative: '#F44336',
  scoreNeutral: '#9E9E9E',
} as const;

export const tribeColors: Record<'VATU' | 'CILA' | 'KALO', string> = {
  VATU: colors.vatu,
  CILA: colors.cila,
  KALO: colors.kalo,
};
