'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Code2, Globe, Menu, Shield, ShieldAlert, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getTranslations } from '@/lib/i18n';
import { DEFAULT_APP_NAME } from '@/lib/branding';

const STORAGE_KEY = 'vaultmail_locale';

export function EmailBreachPage() {
  const [showMenu, setShowMenu] = useState(false);
  const [locale, setLocale] = useState<'en' | 'id'>('en');
  const [customAppName, setCustomAppName] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [breaches, setBreaches] = useState<string[]>([]);
  const [details, setDetails] = useState<
    Array<{
      breach?: string;
      details?: string;
      domain?: string;
      industry?: string;
      logo?: string;
      passwordRisk?: string;
      references?: string;
      searchable?: string;
      verified?: string;
      exposedData?: string;
      exposedDate?: string;
      exposedRecords?: number;
      added?: string;
    }>
  >([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  const handleCheck = async () => {
    const trimmed = email.trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!validEmail) {
      setError(t.breachInvalid);
      setBreaches([]);
      setDetails([]);
      setMessage('');
      setStatus('idle');
      return;
    }
    setStatus('loading');
    setError('');
    setMessage('');
    setBreaches([]);
    setDetails([]);
    try {
      const response = await fetch(`/api/breach-check?email=${encodeURIComponent(trimmed)}`);
      if (!response.ok) {
        throw new Error('Request failed');
      }
      const data = (await response.json()) as {
        breaches?: string[];
        details?: Array<{
          breach?: string;
          details?: string;
          domain?: string;
          industry?: string;
          logo?: string;
          passwordRisk?: string;
          references?: string;
          searchable?: string;
          verified?: string;
          exposedData?: string;
          exposedDate?: string;
          exposedRecords?: number;
          added?: string;
        }>;
      };
      const foundBreaches = Array.isArray(data?.breaches) ? data.breaches : [];
      const foundDetails = Array.isArray(data?.details) ? data.details : [];
      setBreaches(foundBreaches);
      setDetails(foundDetails);
      setStatus('done');
      setMessage(foundBreaches.length ? t.breachExposed : t.breachSafe);
    } catch (error) {
      setStatus('error');
      setError(t.breachError);
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

      <section className="max-w-4xl mx-auto px-4 py-16 w-full">
        <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white">
              <ShieldAlert className="h-5 w-5 text-red-300" />
              <h1 className="text-2xl font-semibold">{t.breachTitle}</h1>
            </div>
            <p className="text-muted-foreground max-w-2xl">{t.breachSubtitle}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              {t.breachInputLabel}
            </label>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t.breachInputPlaceholder}
                type="email"
                className="bg-black/40 border-white/10 text-sm flex-1"
              />
              <Button onClick={handleCheck} disabled={status === 'loading'}>
                {status === 'loading' ? t.breachChecking : t.breachCheck}
              </Button>
            </div>
            {error && <p className="text-xs text-red-300">{error}</p>}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
              {t.breachResultLabel}
            </p>
            {message && <p className="text-sm text-white/80">{message}</p>}
            {breaches.length > 0 && (
              <ul className="grid gap-2 text-sm text-white/80">
                {breaches.map((breach) => (
                  <li key={breach} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    {breach}
                  </li>
                ))}
              </ul>
            )}
            {details.length > 0 && (
              <div className="grid gap-3">
                {details.map((item, index) => (
                  <div
                    key={`${item.breach ?? 'breach'}-${index}`}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80 space-y-2"
                  >
                    <div className="flex items-center gap-3">
                      {item.logo ? (
                        <img src={item.logo} alt={item.breach ?? 'Breach'} className="h-8 w-8 rounded" />
                      ) : null}
                      <div>
                        <p className="text-base font-semibold text-white">{item.breach ?? t.breachUnknown}</p>
                        {item.domain && <p className="text-xs text-white/60">{item.domain}</p>}
                      </div>
                    </div>
                    {item.details && <p className="text-xs text-white/70">{item.details}</p>}
                    <div className="grid gap-1 text-xs text-white/60">
                      {item.exposedDate && (
                        <p>
                          {t.breachExposedDate}: {item.exposedDate}
                        </p>
                      )}
                      {typeof item.exposedRecords === 'number' && (
                        <p>
                          {t.breachExposedRecords}: {item.exposedRecords.toLocaleString()}
                        </p>
                      )}
                      {item.exposedData && (
                        <p>
                          {t.breachExposedData}: {item.exposedData}
                        </p>
                      )}
                      {item.passwordRisk && (
                        <p>
                          {t.breachPasswordRisk}: {item.passwordRisk}
                        </p>
                      )}
                      {item.references && (
                        <Link
                          href={item.references}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-200 hover:text-blue-100"
                        >
                          {t.breachReference}
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!message && !error && (
              <p className="text-xs text-white/50">{t.breachEmpty}</p>
            )}
            <p className="text-[11px] text-white/40">
              {t.breachSource}{' '}
              <Link
                href="https://xposedornot.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-200 hover:text-blue-100"
              >
                XposedOrNot
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
