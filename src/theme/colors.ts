// Survivor-themed light mode color palette
export const colors = {
  // Brand — torch red
  primary: '#C4402F',
  primaryDark: '#8B2D1F',
  primaryLight: '#E8A090',

  // Tribe colors
  vatu: '#2E7D32',    // forest green
  cila: '#1565C0',    // ocean blue
  kalo: '#F57F17',    // warm amber

  // Backgrounds — light theme
  background: '#F2F2F7',      // iOS system grouped background
  surface: '#FFFFFF',          // card/row background
  surfaceElevated: '#FFFFFF',  // elevated surfaces
  border: '#E0E0E5',           // subtle separator

  // Glass surfaces
  surfaceGlass: 'rgba(255, 255, 255, 0.7)',
  borderGlass: 'rgba(0, 0, 0, 0.08)',
  primaryGlass: 'rgba(196, 64, 47, 0.12)',

  // Text
  textPrimary: '#1C1C1E',      // iOS label
  textSecondary: '#6C6C70',    // iOS secondary label
  textMuted: '#AEAEB2',        // iOS tertiary label

  // Feedback
  success: '#34C759',          // iOS green
  error: '#FF3B30',            // iOS red
  warning: '#FF9500',          // iOS orange
  pending: '#AEAEB2',

  // Score display
  scorePositive: '#34C759',
  scoreNegative: '#FF3B30',
  scoreNeutral: '#AEAEB2',
} as const;

export const defaultTribeColors: Record<string, string> = {
  VATU: colors.vatu,
  CILA: colors.cila,
  KALO: colors.kalo,
  MERGED: '#8E8E93',
};
