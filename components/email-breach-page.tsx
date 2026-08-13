'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

import { AppShell, useAppChrome } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type BreachDetail = {
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
};

export function EmailBreachPage() {
  return (
    <AppShell contentClassName="max-w-4xl">
      <EmailBreachContent />
    </AppShell>
  );
}

function EmailBreachContent() {
  const { t } = useAppChrome();
  const [email, setEmail] = useState('');
  const [breaches, setBreaches] = useState<string[]>([]);
  const [details, setDetails] = useState<BreachDetail[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
        details?: BreachDetail[];
      };
      const foundBreaches = Array.isArray(data?.breaches) ? data.breaches : [];
      const foundDetails = Array.isArray(data?.details) ? data.details : [];
      setBreaches(foundBreaches);
      setDetails(foundDetails);
      setStatus('done');
      setMessage(foundBreaches.length ? t.breachExposed : t.breachSafe);
    } catch {
      setStatus('error');
      setError(t.breachError);
    }
  };

  return (
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
        {!message && !error && <p className="text-xs text-white/50">{t.breachEmpty}</p>}
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
  );
}
