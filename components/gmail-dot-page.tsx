'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Code2, Copy, Globe, MailPlus, Menu, Shield, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getTranslations } from '@/lib/i18n';
import { DEFAULT_APP_NAME } from '@/lib/branding';

const STORAGE_KEY = 'vaultmail_locale';
const MAX_VARIANTS = 128;

const normalizeLocalPart = (value: string) =>
  value
    .toLowerCase()
    .replace(/@gmail\.com|@googlemail\.com/gi, '')
    .replace(/\./g, '')
    .replace(/[^a-z0-9]/g, '');

const buildVariants = (localPart: string) => {
  if (localPart.length <= 1) return [localPart];
  const positions = localPart.length - 1;
  const total = 2 ** positions;
  const variants: string[] = [];
  for (let mask = 0; mask < total; mask += 1) {
    let result = '';
    for (let i = 0; i < localPart.length; i += 1) {
      result += localPart[i];
      if (i < localPart.length - 1 && (mask & (1 << i))) {
        result += '.';
      }
    }
    variants.push(result);
    if (variants.length >= MAX_VARIANTS) break;
  }
  return variants;
};

export function GmailDotPage() {
  const [showMenu, setShowMenu] = useState(false);
  const [locale, setLocale] = useState<'en' | 'id'>('en');
  const [customAppName, setCustomAppName] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

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

  const localPart = useMemo(() => normalizeLocalPart(inputValue), [inputValue]);
  const variants = useMemo(() => buildVariants(localPart), [localPart]);

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(value);
      setTimeout(() => setCopyStatus(null), 1200);
    } catch (error) {
      setCopyStatus(null);
    }
  };

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
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 py-16 w-full">
        <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white">
              <MailPlus className="h-5 w-5 text-blue-300" />
              <h1 className="text-2xl font-semibold">{t.gmailDotTitle}</h1>
            </div>
            <p className="text-muted-foreground max-w-2xl">{t.gmailDotSubtitle}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              {t.gmailDotInputLabel}
            </label>
            <Input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={t.gmailDotInputPlaceholder}
              className="bg-black/40 border-white/10 text-sm"
            />
            <p className="text-xs text-white/60">
              {t.gmailDotHint.replace('{count}', `${variants.length}`)}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              {t.gmailDotResultsLabel}
            </p>
            {localPart ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {variants.map((variant) => {
                  const full = `${variant}@gmail.com`;
                  return (
                    <div
                      key={full}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <span className="font-mono text-xs text-white/80 truncate">{full}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(full)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold',
                          copyStatus === full ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70'
                        )}
                      >
                        <Copy className="h-3 w-3" />
                        {copyStatus === full ? t.gmailDotCopied : t.gmailDotCopy}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-white/50">{t.gmailDotEmpty}</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
