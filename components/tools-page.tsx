'use client';

import Link from 'next/link';
import {
  Binary,
  Calendar,
  Coins,
  Key,
  KeyRound,
  MailPlus,
  ShieldAlert,
  Wrench,
} from 'lucide-react';

import { AppShell, useAppChrome } from '@/components/app-shell';

const DEFAULT_TOTP_SECRET = 'FRN7276QJFZOQ7OFI2UIVUVQQ6V3QRIL';

export function ToolsPage() {
  return (
    <AppShell contentClassName="max-w-6xl">
      <ToolsContent />
    </AppShell>
  );
}

function ToolsContent() {
  const { t } = useAppChrome();

  return (
    <div className="glass-card rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white">
            <Wrench className="h-5 w-5 text-orange-300" />
            <h1 className="text-2xl font-semibold">{t.toolsTitle}</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">{t.toolsSubtitle}</p>
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
          <p className="text-xs text-muted-foreground">{t.toolsTwoFaDesc}</p>
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
          <p className="text-xs text-muted-foreground">{t.toolsGmailDotDesc}</p>
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
          <p className="text-xs text-muted-foreground">{t.toolsRefundDesc}</p>
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
          <p className="text-xs text-muted-foreground">{t.toolsTokenDesc}</p>
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
          <p className="text-xs text-muted-foreground">{t.toolsDayCounterDesc}</p>
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
          <p className="text-xs text-muted-foreground">{t.toolsUrlCodecDesc}</p>
          <Link
            href="/url-codec"
            className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            {t.toolsUrlCodecCta}
          </Link>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-white">
            <ShieldAlert className="h-4 w-4 text-red-200" />
            <p className="text-sm font-semibold">{t.toolsBreachTitle}</p>
          </div>
          <p className="text-xs text-muted-foreground">{t.toolsBreachDesc}</p>
          <Link
            href="/email-breach"
            className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            {t.toolsBreachCta}
          </Link>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
            {t.menuTools}
          </p>
          <p className="mt-3 text-sm text-white/80">{t.toolsSubtitle}</p>
        </div>
      </div>
    </div>
  );
}
