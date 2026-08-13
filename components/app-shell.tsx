'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { Code2, Globe, Menu, Shield, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DEFAULT_LOCALE,
  getTranslations,
  SUPPORTED_LOCALES,
  type Locale,
  type Translations,
} from '@/lib/i18n';
import { DEFAULT_APP_NAME } from '@/lib/branding';

const STORAGE_KEY = 'vaultmail_locale';
const LOCALE_EVENT = 'vaultmail-locale-change';

const isLocale = (value: string | null): value is Locale =>
  Boolean(value && SUPPORTED_LOCALES.includes(value as Locale));

const readStoredLocale = (): Locale => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Ignore unavailable storage, e.g. privacy mode.
  }
  return DEFAULT_LOCALE;
};

const subscribeLocale = (onStoreChange: () => void) => {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(LOCALE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(LOCALE_EVENT, onStoreChange);
  };
};

type AppChromeValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
  resolvedAppName: string;
};

const AppChromeContext = createContext<AppChromeValue | null>(null);

export function useAppChrome() {
  const value = useContext(AppChromeContext);
  if (!value) {
    throw new Error('useAppChrome must be used within AppShell');
  }
  return value;
}

type AppShellProps = {
  children: ReactNode;
  contentClassName?: string;
};

export function AppShell({ children, contentClassName = 'max-w-5xl' }: AppShellProps) {
  const [showMenu, setShowMenu] = useState(false);
  const locale = useSyncExternalStore(subscribeLocale, readStoredLocale, () => DEFAULT_LOCALE);
  const [customAppName, setCustomAppName] = useState<string | null>(null);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
    window.dispatchEvent(new Event(LOCALE_EVENT));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const response = await fetch('/api/branding');
        if (!response.ok) return;
        const data = (await response.json()) as { appName?: string };
        setCustomAppName(data?.appName?.trim() || DEFAULT_APP_NAME);
      } catch (error) {
        console.error(error);
      }
    };

    loadBranding();
  }, []);

  const t = useMemo(() => getTranslations(locale), [locale]);
  const resolvedAppName = customAppName || t.appName;
  const value = useMemo(
    () => ({ locale, setLocale, t, resolvedAppName }),
    [locale, setLocale, t, resolvedAppName]
  );

  return (
    <AppChromeContext.Provider value={value}>
      <main className="min-h-screen bg-gradient-to-b from-background to-background/50 relative overflow-hidden flex flex-col">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <header className="border-b border-white/5 bg-background/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <span>{resolvedAppName}</span>
            </Link>
            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowMenu((prev) => !prev)}
                className={cn(
                  'h-12 w-12 rounded-full border border-white/10 bg-white/10 text-white',
                  showMenu && 'bg-white/10'
                )}
              >
                <Menu className="h-5 w-5 text-blue-200" />
              </Button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-white/10 bg-slate-900/90 shadow-2xl overflow-hidden">
                    <div className="p-2 space-y-2">
                      <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                        Menu
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setLocale(locale === 'id' ? 'en' : 'id');
                          setShowMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
                      >
                        <Globe className="h-4 w-4 text-blue-300" />
                        {locale === 'id' ? t.languageEnglish : t.languageIndonesian}
                      </button>
                      <Link
                        href="/admin"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
                        onClick={() => setShowMenu(false)}
                      >
                        <Shield className="h-4 w-4 text-purple-300" />
                        Admin Dashboard
                      </Link>
                      <Link
                        href="/api-access"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
                        onClick={() => setShowMenu(false)}
                      >
                        <Code2 className="h-4 w-4 text-blue-300" />
                        {t.menuApiAccess}
                      </Link>
                      <Link
                        href="/tools"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
                        onClick={() => setShowMenu(false)}
                      >
                        <Wrench className="h-4 w-4 text-orange-300" />
                        {t.menuTools}
                      </Link>
                      <Link
                        href="https://github.com/yasirarism"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
                        onClick={() => setShowMenu(false)}
                      >
                        <Shield className="h-4 w-4 text-green-300" />
                        {t.github}
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <section className={cn(contentClassName, 'mx-auto px-4 py-16 w-full')}>
          {children}
        </section>
      </main>
    </AppChromeContext.Provider>
  );
}
