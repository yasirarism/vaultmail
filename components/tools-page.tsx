'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, Globe, KeyRound, MailPlus, Menu, Shield, Wrench, Binary, Coins, Key } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getTranslations } from '@/lib/i18n';
import { DEFAULT_APP_NAME } from '@/lib/branding';

const STORAGE_KEY = 'vaultmail_locale';
const DEFAULT_TOTP_SECRET = 'FRN7276QJFZOQ7OFI2UIVUVQQ6V3QRIL';

export function ToolsPage() {
  const [showMenu, setShowMenu] = useState(false);
  const [locale, setLocale] = useState<'en' | 'id'>('en');
  const [customAppName, setCustomAppName] = useState<string | null>(null);

  useEffect(() => {
    const storedLocale = localStorage.getItem(STORAGE_KEY);
    if (storedLocale === 'en' || storedLocale === 'id') {
      setLocale(storedLocale);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const t = useMemo(() => getTranslations(locale), [locale]);
  const resolvedAppName = customAppName || t.appName;

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const response = await fetch('/api/branding');
        if (!response.ok) return;
        const data = (await response.json()) as { appName?: string };
        const value = data?.appName?.trim();
        setCustomAppName(value || DEFAULT_APP_NAME);
      } catch (error) {
        console.error(error);
      }
    };

    loadBranding();
  }, []);

  return (
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
          <div className="flex items-center gap-4">
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
                        <Binary className="h-4 w-4 text-blue-300" />
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
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-16 w-full">
        <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Wrench className="h-5 w-5 text-orange-300" />
                <h1 className="text-2xl font-semibold">{t.toolsTitle}</h1>
              </div>
              <p className="text-muted-foreground max-w-2xl">
                {t.toolsSubtitle}
              </p>
            </div>
            <span className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
              {t.toolsTitle}
            </span>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <KeyRound className="h-4 w-4 text-orange-200" />
                <p className="text-sm font-semibold">{t.toolsTwoFaTitle}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.toolsTwoFaDesc}
              </p>
              <Link
                href={`/2fa-gen?key=${DEFAULT_TOTP_SECRET}`}
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                {t.toolsTwoFaCta}
              </Link>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <MailPlus className="h-4 w-4 text-blue-200" />
                <p className="text-sm font-semibold">{t.toolsGmailDotTitle}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.toolsGmailDotDesc}
              </p>
              <Link
                href="/gmail-dot"
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                {t.toolsGmailDotCta}
              </Link>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Coins className="h-4 w-4 text-emerald-200" />
                <p className="text-sm font-semibold">{t.toolsRefundTitle}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.toolsRefundDesc}
              </p>
              <Link
                href="/refund-calculator"
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                {t.toolsRefundCta}
              </Link>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Key className="h-4 w-4 text-purple-200" />
                <p className="text-sm font-semibold">{t.toolsTokenTitle}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.toolsTokenDesc}
              </p>
              <Link
                href="/token-generator"
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                {t.toolsTokenCta}
              </Link>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Calendar className="h-4 w-4 text-blue-200" />
                <p className="text-sm font-semibold">{t.toolsDayCounterTitle}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.toolsDayCounterDesc}
              </p>
              <Link
                href="/day-counter"
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                {t.toolsDayCounterCta}
              </Link>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Binary className="h-4 w-4 text-orange-200" />
                <p className="text-sm font-semibold">{t.toolsUrlCodecTitle}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.toolsUrlCodecDesc}
              </p>
              <Link
                href="/url-codec"
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                {t.toolsUrlCodecCta}
              </Link>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                {t.menuTools}
              </p>
              <p className="mt-3 text-sm text-white/80">
                {t.toolsSubtitle}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
