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

export const getStoredDefaultTheme = async (): Promise<VisualTheme> => {
  try {
    if (!(await isStorageConfigured())) {
      return DEFAULT_THEME;
    }
    const stored = await storage.get(THEME_SETTINGS_KEY);
    const settings = parseThemeSettings(stored);
    return normalizeThemeValue(settings?.defaultTheme);
  } catch {
    return DEFAULT_THEME;
  }
};
