'use client';

import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from 'react';

import {
  applyTheme,
  DEFAULT_THEME,
  isVisualTheme,
  readStoredTheme,
  setStoredTheme,
  subscribeTheme,
  THEME_EVENT,
  THEME_STORAGE_KEY,
  type VisualTheme,
} from '@/lib/theme';

let siteThemePromise: Promise<unknown> | null = null;

const fetchSiteTheme = () => {
  if (!siteThemePromise) {
    siteThemePromise = fetch('/api/branding')
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
  }
  return siteThemePromise;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, readStoredTheme, () => DEFAULT_THEME);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    // Visitors without a personal preference follow the admin-configured
    // default theme. Reconcile with the server in case the HTML was served
    // from a stale static cache.
    let hasPersonalChoice = false;
    try {
      hasPersonalChoice = Boolean(localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      return;
    }
    if (hasPersonalChoice) return;

    let cancelled = false;
    void fetchSiteTheme().then((data) => {
      if (cancelled || !data || typeof data !== 'object') return;
      const siteTheme = (data as { defaultTheme?: unknown }).defaultTheme;
      if (typeof siteTheme !== 'string' || !isVisualTheme(siteTheme)) return;
      if (document.documentElement.getAttribute('data-theme') === siteTheme) return;
      applyTheme(siteTheme);
      window.dispatchEvent(new Event(THEME_EVENT));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return children;
}

export function useVisualTheme() {
  const theme = useSyncExternalStore(subscribeTheme, readStoredTheme, () => DEFAULT_THEME);
  const setTheme = useCallback((next: VisualTheme) => {
    setStoredTheme(next);
  }, []);
  return { theme, setTheme };
}
