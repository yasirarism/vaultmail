'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Database, Gauge, KeyRound, Mail, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DEFAULT_DOMAINS } from "@/lib/config";
import { DEFAULT_LOCALE, getRetentionOptions, getTranslations, Locale, SUPPORTED_LOCALES } from "@/lib/i18n";

const STORAGE_KEY = 'vaultmail_locale';
const REFRESH_INTERVAL_MS = 2000;
const ACTIVITY_KEY = 'dispo_admin_activity';
const DEFAULT_RETENTION = 86400;

type ActivityItem = {
  title: string;
  desc: string;
  time: string;
};

export function AdminPage() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [stats, setStats] = useState({
    emailCount: 0,
    inboxCount: 0,
    domainCount: DEFAULT_DOMAINS.length,
    retentionSeconds: DEFAULT_RETENTION,
    lastSync: '',
    activeAddress: '',
  });
  const [savingRetention, setSavingRetention] = useState(false);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);

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
  const retentionOptions = useMemo(() => getRetentionOptions(locale), [locale]);

  const refreshStats = useCallback(() => {
    const storedDomains = localStorage.getItem('dispo_domains');
    const storedHistory = localStorage.getItem('dispo_history');
    const storedRetention = localStorage.getItem('dispo_default_retention');
    const storedEmailCount = localStorage.getItem('dispo_email_count');
    const storedLastSync = localStorage.getItem('dispo_last_sync');
    const storedAddress = localStorage.getItem('dispo_address');

    const parsedDomains = storedDomains ? (JSON.parse(storedDomains) as string[]) : DEFAULT_DOMAINS;
    const parsedHistory = storedHistory ? (JSON.parse(storedHistory) as string[]) : [];

    setStats({
      emailCount: storedEmailCount ? parseInt(storedEmailCount) : 0,
      inboxCount: parsedHistory.length,
      domainCount: parsedDomains.length,
      retentionSeconds: storedRetention ? parseInt(storedRetention) : DEFAULT_RETENTION,
      lastSync: storedLastSync ?? '',
      activeAddress: storedAddress ?? '',
    });
  }, []);

  useEffect(() => {
    refreshStats();
    const interval = window.setInterval(refreshStats, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refreshStats]);

  useEffect(() => {
    const stored = localStorage.getItem(ACTIVITY_KEY);
    if (stored) {
      setActivityItems(JSON.parse(stored) as ActivityItem[]);
    } else {
      const defaults = [
        {
          title: t.adminActivityBootTitle,
          desc: t.adminActivityBootDesc,
          time: t.adminActivityBootTime,
        },
      ];
      setActivityItems(defaults);
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(defaults));
    }
  }, [t]);

  const addActivity = useCallback((item: ActivityItem) => {
    setActivityItems((prev) => {
      const updated = [item, ...prev].slice(0, 6);
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const currentRetentionLabel =
    retentionOptions.find((option) => option.value === stats.retentionSeconds)?.label ??
    retentionOptions[2]?.label ??
    t.retentionOptions.hours24;

  const handleRetentionSave = async (seconds: number) => {
    if (!stats.activeAddress) {
      toast.error(t.adminRetentionMissingAddress);
      return;
    }
    setSavingRetention(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: stats.activeAddress,
          retentionSeconds: seconds,
        }),
      });
      localStorage.setItem('dispo_default_retention', seconds.toString());
      setStats((prev) => ({ ...prev, retentionSeconds: seconds }));
      window.dispatchEvent(new Event('vaultmail-retention-updated'));
      toast.success(t.toastRetentionUpdated);
      addActivity({
        title: t.adminActivityRetentionTitle,
        desc: t.adminActivityRetentionDesc.replace('{duration}', retentionOptions.find((o) => o.value === seconds)?.label ?? ''),
        time: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (error) {
      toast.error(t.toastRetentionFailed);
    } finally {
      setSavingRetention(false);
    }
  };

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
            { icon: Mail, label: t.adminStatsEmails, value: stats.emailCount.toString() },
            { icon: Users, label: t.adminStatsInboxes, value: stats.inboxCount.toString() },
            {
              icon: Gauge,
              label: t.adminStatsDelivery,
              value: stats.lastSync ? t.adminDeliveryLive : t.adminDeliveryIdle,
            },
            { icon: Database, label: t.adminStatsStorage, value: `${stats.domainCount} ${t.adminDomainSuffix}` },
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
                { label: t.adminRetentionLabel, value: currentRetentionLabel },
                { label: t.adminDomainRoutingLabel, value: `${stats.domainCount} ${t.adminDomainSuffix}` },
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

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">{t.adminRetentionManagerTitle}</h2>
              <p className="text-sm text-muted-foreground">{t.adminRetentionManagerDesc}</p>
              {stats.activeAddress ? (
                <p className="text-xs text-muted-foreground">
                  {t.adminRetentionActiveInbox} <span className="font-mono text-white">{stats.activeAddress}</span>
                </p>
              ) : (
                <p className="text-xs text-amber-300">{t.adminRetentionMissingAddress}</p>
              )}
            </div>
            <div className="space-y-3">
              {retentionOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={savingRetention || !stats.activeAddress}
                  onClick={() => handleRetentionSave(option.value)}
                  className={`w-full flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm text-left transition-colors ${
                    option.value === stats.retentionSeconds
                      ? 'border-purple-500/50 bg-purple-500/10 text-white'
                      : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
                  }`}
                >
                  <span>{option.label}</span>
                  {option.value === stats.retentionSeconds ? (
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-purple-200">
                      {t.retentionActive}
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {t.adminRetentionSelect}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t.adminQuickActionsTitle}</h2>
            <Button
              type="button"
              variant="ghost"
              className="text-xs uppercase tracking-widest text-muted-foreground"
              onClick={() => {
                refreshStats();
                addActivity({
                  title: t.adminActivityRefreshTitle,
                  desc: t.adminActivityRefreshDesc,
                  time: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
                });
              }}
            >
              {t.adminRefreshLabel}
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: t.adminActionPurge, icon: Activity, desc: t.adminActionPurgeDesc },
              { label: t.adminActionRotate, icon: KeyRound, desc: t.adminActionRotateDesc },
              { label: t.adminActionExport, icon: Database, desc: t.adminActionExportDesc },
            ].map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => addActivity({
                  title: action.label,
                  desc: action.desc,
                  time: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
                })}
                className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-2 text-left hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{action.label}</p>
                  <action.icon className="h-4 w-4 text-blue-200" />
                </div>
                <p className="text-xs text-muted-foreground">{action.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-xl font-semibold">{t.adminRecentActivityTitle}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {activityItems.map((item) => (
              <div
                key={`${item.title}-${item.time}`}
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
