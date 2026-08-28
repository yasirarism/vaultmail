'use client';

import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from 'react';

import {
  applyTheme,
  DEFAULT_THEME,
  readStoredTheme,
  setStoredTheme,
  subscribeTheme,
  type VisualTheme,
} from '@/lib/theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, readStoredTheme, () => DEFAULT_THEME);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return children;
}

export function useVisualTheme() {
  const theme = useSyncExternalStore(subscribeTheme, readStoredTheme, () => DEFAULT_THEME);
  const setTheme = useCallback((next: VisualTheme) => {
    setStoredTheme(next);
  }, []);
  return { theme, setTheme };
}
