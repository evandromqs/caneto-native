/** Shared visual values from caneto_app_web/app/globals.css. */
export const theme = {
  blue: '#0943F1',
  blueDark: '#0732B8',
  blueLight: '#386BF6',
  blueSoft: '#E8EEFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  ink: '#0F172A',
  inkStrong: '#020817',
  muted: '#475569',
  subtle: '#64748B',
  placeholder: '#334155',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  success: '#059669',
  successSoft: '#ECFDF5',
  warning: '#D97706',
  font: {
    regular: 'Poppins_400Regular',
    semibold: 'Poppins_600SemiBold',
    bold: 'Poppins_700Bold',
    extrabold: 'Poppins_800ExtraBold',
  },
  radius: { xs: 4, sm: 6, md: 8, lg: 12, xl: 15, xxl: 20, xxxl: 24 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  touchTarget: 44,
  dialog: { horizontalMargin: 12, maxWidth: 512, backdrop: 'rgba(2, 6, 23, 0.80)' },
} as const;

export type Theme = typeof theme;
