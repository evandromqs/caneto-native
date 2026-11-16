/** Visual design tokens synchronized with caneto_app_web/app/globals.css. */

type StyleMap = Record<string, object>;

export const lightPalette = {
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
  warningSoft: '#FFFBEB',
};

export const darkPalette = {
  blue: '#0943F1',
  blueDark: '#0732B8',
  blueLight: '#386BF6',
  blueSoft: 'rgba(9, 67, 241, 0.22)',
  background: '#080D1A',
  surface: '#0F172A',
  surfaceMuted: '#1E293B',
  ink: '#F8FAFC',
  inkStrong: '#FFFFFF',
  muted: '#CBD5E1',
  subtle: '#94A3B8',
  placeholder: '#94A3B8',
  border: '#1E293B',
  borderStrong: '#334155',
  danger: '#F87171',
  dangerSoft: 'rgba(248, 113, 113, 0.18)',
  success: '#34D399',
  successSoft: 'rgba(52, 211, 153, 0.18)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.16)',
};

export function getThemeColors(isDark: boolean) {
  return isDark ? darkPalette : lightPalette;
}

const fixedTokens = {
  font: {
    regular: 'Poppins_400Regular',
    semibold: 'Poppins_600SemiBold',
    bold: 'Poppins_700Bold',
    extrabold: 'Poppins_800ExtraBold',
  },
  radius: { xs: 4, sm: 6, md: 8, lg: 12, xl: 15, xxl: 20, xxxl: 24 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  touchTarget: 48,
  dialog: { horizontalMargin: 12, maxWidth: 512, backdrop: 'rgba(2, 6, 23, 0.80)' },
} as const;

type Palette = { [Key in keyof typeof lightPalette]: string };
export type Theme = Palette & typeof fixedTokens & { fontScale: number; highContrast: boolean };

/**
 * Shared live theme. Inline color reads always use the active palette, while
 * createThemedStyles refreshes StyleSheet objects that captured palette values.
 */
export const theme: Theme = {
  ...lightPalette,
  ...fixedTokens,
  fontScale: 1,
  highContrast: false,
};

let darkModeActive = false;
let currentFontScale = 1;
let currentHighContrast = false;
const refreshStyleSheets = new Set<() => void>();

export function isDarkTheme(): boolean {
  return darkModeActive;
}

export function setAppTheme(isDark: boolean, options?: { fontSize?: 'small' | 'normal' | 'large'; highContrast?: boolean }): void {
  const nextScale = options?.fontSize === 'small' ? 0.92 : options?.fontSize === 'large' ? 1.1 : 1;
  const nextContrast = options?.highContrast ?? currentHighContrast;
  if (darkModeActive === isDark && currentFontScale === nextScale && currentHighContrast === nextContrast) return;
  darkModeActive = isDark;
  currentFontScale = nextScale;
  currentHighContrast = nextContrast;
  const base = isDark ? darkPalette : lightPalette;
  Object.assign(theme, base, {
    fontScale: nextScale,
    highContrast: nextContrast,
    ...(nextContrast ? {
      border: isDark ? '#475569' : '#94A3B8',
      borderStrong: isDark ? '#64748B' : '#64748B',
    } : {}),
  });
  refreshStyleSheets.forEach(refresh => refresh());
}

export function createThemedStyles<T extends StyleMap>(factory: (activeTheme: Theme) => T): T {
  let current = factory(theme);
  refreshStyleSheets.add(() => { current = factory(theme); });

  return new Proxy({} as T, {
    get: (_target, property) => current[property as keyof T],
    has: (_target, property) => property in current,
    ownKeys: () => Reflect.ownKeys(current),
    getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
  });
}
