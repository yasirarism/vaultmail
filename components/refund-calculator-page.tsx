'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Code2, Coins, Globe, Menu, Shield, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getTranslations } from '@/lib/i18n';
import { DEFAULT_APP_NAME } from '@/lib/branding';

const STORAGE_KEY = 'vaultmail_locale';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function RefundCalculatorPage() {
  const [showMenu, setShowMenu] = useState(false);
  const [locale, setLocale] = useState<'en' | 'id'>('en');
  const [customAppName, setCustomAppName] = useState<string | null>(null);
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [remainingDays, setRemainingDays] = useState('0');
  const [totalDays, setTotalDays] = useState('30');
  const [refundRate, setRefundRate] = useState('100');

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

  const priceValue = Math.max(Number(purchasePrice) || 0, 0);
  const totalValue = Math.max(Number(totalDays) || 0, 0);
  const remainingValue = clamp(Number(remainingDays) || 0, 0, totalValue || 0);
  const rateValue = clamp(Number(refundRate) || 0, 0, 100);
  const usageRatio = totalValue > 0 ? remainingValue / totalValue : 0;
  const refundAmount = priceValue * usageRatio * (rateValue / 100);
  const refundPercentage = priceValue > 0 ? (refundAmount / priceValue) * 100 : 0;
  const retainedAmount = Math.max(priceValue - refundAmount, 0);

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
              <Coins className="h-5 w-5 text-emerald-300" />
              <h1 className="text-2xl font-semibold">{t.refundTitle}</h1>
            </div>
            <p className="text-muted-foreground max-w-2xl">{t.refundSubtitle}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                {t.refundPurchaseLabel}
              </label>
              <Input
                value={purchasePrice}
                onChange={(event) => setPurchasePrice(event.target.value)}
                type="number"
                min="0"
                className="bg-black/40 border-white/10 text-sm"
                placeholder="0"
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                {t.refundRemainingLabel}
              </label>
              <Input
                value={remainingDays}
                onChange={(event) => setRemainingDays(event.target.value)}
                type="number"
                min="0"
                className="bg-black/40 border-white/10 text-sm"
                placeholder="0"
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                {t.refundTotalLabel}
              </label>
              <Input
                value={totalDays}
                onChange={(event) => setTotalDays(event.target.value)}
                type="number"
                min="1"
                className="bg-black/40 border-white/10 text-sm"
                placeholder="30"
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                {t.refundRateLabel}
              </label>
              <Input
                value={refundRate}
                onChange={(event) => setRefundRate(event.target.value)}
                type="number"
                min="0"
                max="100"
                className="bg-black/40 border-white/10 text-sm"
                placeholder="100"
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-4">
            <div className="flex items-center justify-between text-sm text-white/80">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-blue-200" />
                <span>{t.refundPreviewTitle}</span>
              </div>
              <span>{t.refundPreviewRate.replace('{rate}', `${rateValue}`)}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <div className="space-y-3">
                <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400"
                    style={{ width: `${refundPercentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>{t.refundRefundLabel}</span>
                  <span>{refundPercentage.toFixed(1)}%</span>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1 text-sm text-white/80">
                <div className="flex items-center justify-between">
                  <span>{t.refundAmountLabel}</span>
                  <span>{refundAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-white/60 text-xs">
                  <span>{t.refundRetainedLabel}</span>
                  <span>{retainedAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
