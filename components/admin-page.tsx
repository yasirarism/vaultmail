'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, Database, Gauge, KeyRound, Mail, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_LOCALE, getTranslations, Locale, SUPPORTED_LOCALES } from "@/lib/i18n";

const STORAGE_KEY = 'vaultmail_locale';

export function AdminPage() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
      setLocale(stored as Locale);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const t = useMemo(() => getTranslations(locale), [locale]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/60 relative overflow-hidden">
      <div className="absolute top-12 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <header className="border-b border-white/5 bg-background/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <span>{t.adminTitle}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-3 rounded-full border border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white"
              onClick={() => setLocale(locale === 'en' ? 'id' : 'en')}
            >
              {locale === 'en' ? t.languageIndonesian : t.languageEnglish}
            </Button>
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
            >
              {t.adminBackToInbox}
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-12 space-y-10">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-widest text-muted-foreground">{t.adminEyebrow}</p>
          <h1 className="text-4xl md:text-5xl font-extrabold">{t.adminTitle}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">{t.adminSubtitle}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { icon: Mail, label: t.adminStatsEmails, value: '12.4k' },
            { icon: Users, label: t.adminStatsInboxes, value: '482' },
            { icon: Gauge, label: t.adminStatsDelivery, value: '99.1%' },
            { icon: Database, label: t.adminStatsStorage, value: '3.1 GB' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="text-2xl font-semibold">{item.value}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-blue-200" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{t.adminPolicyTitle}</h2>
              <span className="text-xs uppercase tracking-widest text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-full">
                {t.adminStatusLive}
              </span>
            </div>
            <div className="grid gap-4">
              {[
                { label: t.adminRetentionLabel, value: t.adminRetentionValue },
                { label: t.adminDomainRoutingLabel, value: t.adminDomainRoutingValue },
                { label: t.adminSecurityLabel, value: t.adminSecurityValue },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="text-sm font-medium text-white">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
            <h2 className="text-xl font-semibold">{t.adminQuickActionsTitle}</h2>
            <div className="space-y-3">
              {[
                { label: t.adminActionPurge, icon: Activity },
                { label: t.adminActionRotate, icon: KeyRound },
                { label: t.adminActionExport, icon: Database },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="w-full flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-left hover:bg-white/10 transition-colors"
                >
                  <span>{action.label}</span>
                  <action.icon className="h-4 w-4 text-blue-200" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-xl font-semibold">{t.adminRecentActivityTitle}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {t.adminRecentActivityItems.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-2"
              >
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
                <p className="text-xs text-muted-foreground">{item.time}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
