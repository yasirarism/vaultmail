import { storage, isStorageConfigured } from '@/lib/storage';
import { THEME_SETTINGS_KEY } from '@/lib/admin-auth';
import { DEFAULT_THEME, isVisualTheme, type VisualTheme } from '@/lib/theme';

export type ThemeSettings = {
  defaultTheme?: string;
  /** Naik setiap admin menyimpan tema; dipakai client untuk mendeteksi tema baru. */
  themeVersion?: number;
  updatedAt?: string;
};

/** Nilai awal versi tema; dinaikkan setiap tema admin disimpan. */
const INITIAL_THEME_VERSION = 1;

const parseThemeSettings = (value: unknown): ThemeSettings | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as ThemeSettings;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value as ThemeSettings;
  }
  return null;
};

export const normalizeThemeValue = (value: unknown): VisualTheme =>
  typeof value === 'string' && isVisualTheme(value) ? value : DEFAULT_THEME;

export const normalizeThemeVersion = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : INITIAL_THEME_VERSION;
};

// 'glass' was the hardcoded default before the brutal redesign. Treat a stored
// legacy 'glass' (or an explicit one) as "no explicit preference" so the site
// resolves to the new DEFAULT_THEME (brutal) instead of flipping on load.
const LEGACY_DEFAULT_THEME = 'glass';

export const getStoredThemeSettings = async (): Promise<{
  defaultTheme: VisualTheme;
  themeVersion: number;
}> => {
  try {
    if (!(await isStorageConfigured())) {
      return { defaultTheme: DEFAULT_THEME, themeVersion: INITIAL_THEME_VERSION };
    }
    const stored = await storage.get(THEME_SETTINGS_KEY);
    const settings = parseThemeSettings(stored);
    const value = settings?.defaultTheme;
    return {
      defaultTheme:
        typeof value === 'string' && isVisualTheme(value) && value !== LEGACY_DEFAULT_THEME
          ? value
          : DEFAULT_THEME,
      themeVersion: normalizeThemeVersion(settings?.themeVersion)
    };
  } catch {
    return { defaultTheme: DEFAULT_THEME, themeVersion: INITIAL_THEME_VERSION };
  }
};

export const getStoredDefaultTheme = async (): Promise<VisualTheme> =>
  (await getStoredThemeSettings()).defaultTheme;
