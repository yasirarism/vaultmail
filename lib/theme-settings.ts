import { storage, isStorageConfigured } from '@/lib/storage';
import { THEME_SETTINGS_KEY } from '@/lib/admin-auth';
import { DEFAULT_THEME, isVisualTheme, type VisualTheme } from '@/lib/theme';

export type ThemeSettings = {
  defaultTheme?: string;
  updatedAt?: string;
};

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

// 'glass' was the hardcoded default before the brutal redesign. Treat a stored
// legacy 'glass' (or an explicit one) as "no explicit preference" so the site
// resolves to the new DEFAULT_THEME (brutal) instead of flipping on load.
const LEGACY_DEFAULT_THEME = 'glass';

export const getStoredDefaultTheme = async (): Promise<VisualTheme> => {
  try {
    if (!(await isStorageConfigured())) {
      return DEFAULT_THEME;
    }
    const stored = await storage.get(THEME_SETTINGS_KEY);
    const settings = parseThemeSettings(stored);
    const value = settings?.defaultTheme;
    if (typeof value === 'string' && isVisualTheme(value) && value !== LEGACY_DEFAULT_THEME) {
      return value;
    }
    return DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};
