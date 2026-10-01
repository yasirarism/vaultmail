'use client';

import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from 'react';

import {
  applyServerTheme,
  applyTheme,
  DEFAULT_THEME,
  isVisualTheme,
  readStoredTheme,
  setStoredTheme,
  subscribeTheme,
  THEME_VERSION_KEY,
  type VisualTheme,
} from '@/lib/theme';

type ThemeProviderProps = {
  children: ReactNode;
  /** Tema default yang ditetapkan admin (dibaca server saat render). */
  serverTheme?: VisualTheme;
  /** Versi tema dari admin; naik setiap admin menyimpan tema baru. */
  serverVersion?: number;
};

export function ThemeProvider({ children, serverTheme, serverVersion }: ThemeProviderProps) {
  const theme = useSyncExternalStore(subscribeTheme, readStoredTheme, () => DEFAULT_THEME);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Tema yang ditetapkan admin berlaku untuk SEMUA pengunjung: begitu versi tema di
  // server naik, preferensi lama milik pengunjung ditimpa sekali. Setelah itu
  // pengunjung bebas memilih tema sendiri sampai admin mengubahnya lagi.
  useEffect(() => {
    if (!serverTheme || !isVisualTheme(serverTheme)) return;
    const version = String(serverVersion ?? '');
    if (!version) return;

    let storedVersion: string | null = null;
    try {
      storedVersion = localStorage.getItem(THEME_VERSION_KEY);
    } catch {
      storedVersion = null;
    }

    if (storedVersion === version) return;
    applyServerTheme(serverTheme, version);
  }, [serverTheme, serverVersion]);

  return children;
}

export function useVisualTheme() {
  const theme = useSyncExternalStore(subscribeTheme, readStoredTheme, () => DEFAULT_THEME);
  const setTheme = useCallback((next: VisualTheme) => {
    setStoredTheme(next);
  }, []);
  return { theme, setTheme };
}
