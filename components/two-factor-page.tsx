'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { Copy, KeyRound } from 'lucide-react';

import { AppShell, useAppChrome } from '@/components/app-shell';
import { cn } from '@/lib/utils';
import {
  buildOtpAuthUrl,
  DEFAULT_TOTP_PERIOD,
  generateTotpWindowAsync,
  getRemainingSeconds,
  getTotpCounter,
  parseTotpInput,
} from '@/lib/totp';
import {
  getClockOffsetMs,
  getSyncedNow,
  hasServerTimeSync,
  syncServerTime,
} from '@/lib/time-sync';

const CLOCK_DRIFT_WARNING_MS = 2000;

interface TwoFactorPageProps {
  initialSecret?: string;
}

export function TwoFactorPage({ initialSecret = '' }: TwoFactorPageProps) {
  return (
    <AppShell>
      <TwoFactorContent initialSecret={initialSecret} />
    </AppShell>
  );
}

function TwoFactorContent({ initialSecret = '' }: TwoFactorPageProps) {
  const { t, resolvedAppName } = useAppChrome();
  const [totpSecret, setTotpSecret] = useState(initialSecret);
  const [totpCode, setTotpCode] = useState('');
  const [previousCode, setPreviousCode] = useState('');
  const [nextCode, setNextCode] = useState('');
  const [totpError, setTotpError] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_TOTP_PERIOD);
  const [periodSeconds, setPeriodSeconds] = useState(DEFAULT_TOTP_PERIOD);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [timeSynced, setTimeSynced] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentKeyParam = searchParams?.get('key') ?? '';

  const totpConfig = useMemo(() => parseTotpInput(totpSecret), [totpSecret]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (totpSecret === currentKeyParam) return;
      const params = new URLSearchParams(searchParams?.toString());
      if (totpSecret.trim()) {
        params.set('key', totpSecret);
      } else {
        params.delete('key');
      }
      const nextQuery = params.toString();
      router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ''}`, { scroll: false });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [currentKeyParam, pathname, router, searchParams, totpSecret]);

  useEffect(() => {
    let cancelled = false;
    let lastCounter = Number.NaN;
    let requestId = 0;

    const applyOffset = () => {
      setClockOffsetMs(getClockOffsetMs());
      setTimeSynced(hasServerTimeSync());
    };

    const refresh = async (force = false) => {
      const now = getSyncedNow();
      const config = parseTotpInput(totpSecret);

      if (!config) {
        lastCounter = Number.NaN;
        if (!cancelled) {
          setPreviousCode('');
          setTotpCode('');
          setNextCode('');
          setRemainingSeconds(DEFAULT_TOTP_PERIOD);
          setPeriodSeconds(DEFAULT_TOTP_PERIOD);
          setTotpError(totpSecret.trim() ? 'Invalid secret' : '');
        }
        return;
      }

      const remaining = getRemainingSeconds(now, config.period);
      const counter = getTotpCounter(now, config.period);
      if (!cancelled) {
        setRemainingSeconds(remaining);
        setPeriodSeconds(config.period);
      }

      if (!force && counter === lastCounter) {
        return;
      }

      const currentRequest = ++requestId;
      try {
        const windowCodes = await generateTotpWindowAsync(config, now);
        if (cancelled || currentRequest !== requestId) return;
        lastCounter = windowCodes.counter;
        setPreviousCode(windowCodes.previous);
        setTotpCode(windowCodes.current);
        setNextCode(windowCodes.next);
        setRemainingSeconds(windowCodes.remaining);
        setTotpError(windowCodes.current ? '' : 'Invalid secret');
      } catch {
        if (!cancelled) {
          lastCounter = Number.NaN;
          setPreviousCode('');
          setTotpCode('');
          setNextCode('');
          setTotpError('Failed to generate code');
        }
      }
    };

    const start = async () => {
      await syncServerTime();
      if (cancelled) return;
      applyOffset();
      await refresh(true);
    };

    void start();
    const interval = window.setInterval(() => {
      void refresh(false);
    }, 250);

    const onResume = () => {
      if (document.visibilityState === 'hidden') return;
      void syncServerTime(true).then(() => {
        if (cancelled) return;
        applyOffset();
        void refresh(true);
      });
    };

    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    window.addEventListener('online', onResume);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
      window.removeEventListener('online', onResume);
    };
  }, [totpSecret]);

  useEffect(() => {
    let active = true;

    const buildQrCode = async () => {
      if (!totpConfig) {
        if (active) setQrCodeDataUrl('');
        return;
      }
      const issuer = totpConfig.issuer || resolvedAppName || 'VaultMail';
      const otpAuth = buildOtpAuthUrl(totpConfig, issuer);
      try {
        const url = await QRCode.toDataURL(otpAuth, { margin: 1, width: 200 });
        if (active) setQrCodeDataUrl(url);
      } catch {
        if (active) setQrCodeDataUrl('');
      }
    };

    void buildQrCode();

    return () => {
      active = false;
    };
  }, [resolvedAppName, totpConfig]);

  const handleCopy = async () => {
    if (!totpCode) return;
    try {
      await navigator.clipboard.writeText(totpCode);
      setCopyStatus('copied');
      window.setTimeout(() => setCopyStatus('idle'), 1500);
    } catch {
      setCopyStatus('idle');
    }
  };

  const driftSeconds = Math.round(Math.abs(clockOffsetMs) / 1000);
  const showDriftWarning = timeSynced && Math.abs(clockOffsetMs) >= CLOCK_DRIFT_WARNING_MS;
  const progressWidth = `${(remainingSeconds / periodSeconds) * 100}%`;

  return (
    <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-white">
            <KeyRound className="h-5 w-5 text-orange-300" />
            <h1 className="text-2xl font-semibold">{t.toolsTwoFaTitle}</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">{t.toolsTwoFaDesc}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr_0.9fr]">
        <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
            {t.twoFaSecretLabel}
          </label>
          <input
            value={totpSecret}
            onChange={(event) => setTotpSecret(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-400/60"
            placeholder={t.twoFaSecretPlaceholder}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">{t.twoFaSecretHint}</p>
          {totpConfig &&
            (totpConfig.algorithm !== 'SHA-1' ||
              totpConfig.digits !== 6 ||
              totpConfig.period !== DEFAULT_TOTP_PERIOD) && (
              <p className="text-[11px] font-mono text-white/50">
                {totpConfig.algorithm} · {totpConfig.digits} digits · {totpConfig.period}s
              </p>
            )}
        </div>
        <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
            {t.twoFaCodeLabel}
          </p>
          <div className="space-y-3">
            <CodeRow label={t.twoFaPrevious} value={previousCode} />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                  {t.twoFaCurrent}
                </p>
                <p className="text-3xl font-bold text-white tracking-[0.3em]">
                  {totpCode || '------'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold transition',
                  totpCode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white/5 text-white/40'
                )}
                disabled={!totpCode}
              >
                <Copy className="h-3.5 w-3.5" />
                {copyStatus === 'copied' ? t.twoFaCopied : t.twoFaCopy}
              </button>
            </div>
            <CodeRow label={t.twoFaNext} value={nextCode} />
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-400 to-purple-500 transition-[width] duration-200"
              style={{ width: progressWidth }}
            />
          </div>
          <p className="text-xs text-white/60">
            {totpError
              ? t.twoFaInvalid
              : t.twoFaCountdown.replace('{seconds}', `${remainingSeconds}`)}
          </p>
          {showDriftWarning ? (
            <p className="text-[11px] text-amber-300">
              {t.twoFaClockDrift.replace('{seconds}', `${driftSeconds}`)}
            </p>
          ) : timeSynced ? (
            <p className="text-[11px] text-white/40">{t.twoFaTimeSynced}</p>
          ) : null}
        </div>
        <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3 flex flex-col items-center text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
            {t.twoFaQrLabel}
          </p>
          {qrCodeDataUrl ? (
            // Data URL QR codes are generated locally; next/image is not useful here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrCodeDataUrl}
              alt={t.twoFaQrLabel}
              className="h-32 w-32 rounded-lg border border-white/10 bg-white/5 p-2"
            />
          ) : (
            <div className="h-32 w-32 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-xs text-white/50">
              {t.twoFaQrEmpty}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
        <span>{t.twoFaNotice}</span>
        <Link
          href="/tools"
          className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/80 transition hover:bg-white/10"
        >
          {t.menuTools}
        </Link>
      </div>
    </div>
  );
}

function CodeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs text-white/60">
      <span>{label}</span>
      <span className="font-mono text-sm text-white/80 tracking-[0.2em]">
        {value || '------'}
      </span>
    </div>
  );
}
