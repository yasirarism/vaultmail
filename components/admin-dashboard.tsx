'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Clock,
  Copy,
  Loader2,
  Plus,
  ShieldCheck,
  ShieldOff,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { DEFAULT_APP_NAME } from '@/lib/branding';

type TelegramSettings = {
  enabled: boolean;
  botToken: string;
  chatId: string;
  allowedDomains?: string[];
};

type RetentionSettings = {
  seconds: number;
};

type BrandingSettings = {
  appName: string;
};

type HomepageLockSettings = {
  enabled: boolean;
  hasPassword: boolean;
  updatedAt?: string;
};

type DomainsSettings = {
  domains: string[];
};

type AdminStats = {
  inboxCount: number;
  messageCount: number;
  latestReceivedAt: string | null;
};

const normalizeDomains = (domains: string[]) =>
  [...new Set(domains.map((domain) => domain.toLowerCase().trim()).filter(Boolean))];

export function AdminDashboard() {
  const [enabled, setEnabled] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [availableDomains, setAvailableDomains] = useState<string[]>([]);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [retentionSeconds, setRetentionSeconds] = useState(86400);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [domainsSaving, setDomainsSaving] = useState(false);
  const [appName, setAppName] = useState(DEFAULT_APP_NAME);
  const [homepageLockEnabled, setHomepageLockEnabled] = useState(false);
  const [homepageLockPassword, setHomepageLockPassword] = useState('');
  const [homepageLockSaving, setHomepageLockSaving] = useState(false);
  const [homepageLockHasPassword, setHomepageLockHasPassword] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState<string | null>(null);

  const retentionOptions = useMemo(
    () => [
      { label: '30 menit', value: 1800 },
      { label: '1 jam', value: 3600 },
      { label: '24 jam', value: 86400 },
      { label: '3 hari', value: 259200 },
      { label: '1 minggu', value: 604800 }
    ],
    []
  );

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [
        telegramResponse,
        retentionResponse,
        brandingResponse,
        domainsResponse,
        homepageLockResponse
      ] = await Promise.all([
        fetch('/api/admin/telegram'),
        fetch('/api/admin/retention'),
        fetch('/api/admin/branding'),
        fetch('/api/admin/domains'),
        fetch('/api/admin/homepage-lock')
      ]);
      if (
        !telegramResponse.ok ||
        !retentionResponse.ok ||
        !brandingResponse.ok ||
        !domainsResponse.ok ||
        !homepageLockResponse.ok
      ) {
        throw new Error('Unauthorized or failed to load settings.');
      }
      const data = (await telegramResponse.json()) as TelegramSettings;
      const retentionData =
        (await retentionResponse.json()) as RetentionSettings;
      const brandingData = (await brandingResponse.json()) as BrandingSettings;
      const domainsData = (await domainsResponse.json()) as DomainsSettings;
      const homepageLockData =
        (await homepageLockResponse.json()) as HomepageLockSettings;
      setEnabled(Boolean(data.enabled));
      setBotToken(data.botToken || '');
      setChatId(data.chatId || '');
      const incomingAvailable = normalizeDomains(domainsData?.domains || []);
      const incomingAllowed = normalizeDomains(
        Array.isArray(data.allowedDomains) ? data.allowedDomains : []
      );
      setAvailableDomains(incomingAvailable);
      setAllowedDomains(
        incomingAllowed.length > 0 ? incomingAllowed : incomingAvailable
      );
      if (retentionData?.seconds) {
        setRetentionSeconds(retentionData.seconds);
      }
      if (brandingData?.appName) {
        setAppName(brandingData.appName);
      }
      setHomepageLockEnabled(Boolean(homepageLockData?.enabled));
      setHomepageLockHasPassword(Boolean(homepageLockData?.hasPassword));
    } catch (error) {
      console.error(error);
      toast.error('Failed to load admin settings.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(false);
    try {
      const response = await fetch('/api/admin/stats');
      if (!response.ok) {
        throw new Error('Unauthorized or failed to load stats.');
      }
      const data = (await response.json()) as AdminStats;
      setStats(data);
    } catch (error) {
      console.error(error);
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const filteredAllowed = allowedDomains.filter((domain) =>
        availableDomains.includes(domain)
      );
      const response = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled,
          botToken,
          chatId,
          allowedDomains: filteredAllowed
        })
      });
      if (!response.ok) {
        throw new Error('Unauthorized or failed to save settings.');
      }
      setAllowedDomains(filteredAllowed);
      toast.success('Telegram settings saved.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save Telegram settings.');
    } finally {
      setSaving(false);
    }
  };

  const saveRetention = async (value: number) => {
    setRetentionSeconds(value);
    setRetentionSaving(true);
    try {
      const response = await fetch('/api/admin/retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds: value })
      });
      if (!response.ok) {
        throw new Error('Unauthorized or failed to save retention.');
      }
      toast.success('Retention settings saved.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save retention settings.');
    } finally {
      setRetentionSaving(false);
    }
  };

  const saveBranding = async () => {
    setBrandingSaving(true);
    try {
      const response = await fetch('/api/admin/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName })
      });
      if (!response.ok) {
        throw new Error('Unauthorized or failed to save branding.');
      }
      toast.success('Site name saved.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save site name.');
    } finally {
      setBrandingSaving(false);
    }
  };

  const saveHomepageLock = async () => {
    if (homepageLockEnabled && !homepageLockPassword.trim() && !homepageLockHasPassword) {
      toast.error('Masukkan password untuk mengaktifkan homepage lock.');
      return;
    }
    setHomepageLockSaving(true);
    try {
      const response = await fetch('/api/admin/homepage-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: homepageLockEnabled,
          password: homepageLockPassword || undefined
        })
      });
      if (!response.ok) {
        throw new Error('Unauthorized or failed to save homepage lock.');
      }
      const data = (await response.json()) as HomepageLockSettings;
      setHomepageLockEnabled(Boolean(data.enabled));
      setHomepageLockHasPassword(Boolean(data.hasPassword));
      setHomepageLockPassword('');
      toast.success('Homepage lock saved.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save homepage lock.');
    } finally {
      setHomepageLockSaving(false);
    }
  };

  const saveDomains = async (
    nextDomains: string[],
    successMessage = 'Domains saved.'
  ) => {
    setDomainsSaving(true);
    try {
      const response = await fetch('/api/admin/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: nextDomains })
      });
      if (!response.ok) {
        throw new Error('Unauthorized or failed to save domains.');
      }
      const data = (await response.json()) as DomainsSettings;
      const normalized = normalizeDomains(data.domains || []);
      setAvailableDomains(normalized);
      setAllowedDomains((prev) =>
        prev.filter((domain) => normalized.includes(domain))
      );
      toast.success(successMessage);
    } catch (error) {
      console.error(error);
      toast.error('Failed to save domains.');
    } finally {
      setDomainsSaving(false);
    }
  };

  const handleAddDomain = async () => {
    const domain = newDomain.toLowerCase().trim();
    if (!domain || availableDomains.includes(domain)) return;
    const nextDomains = normalizeDomains([...availableDomains, domain]);
    setNewDomain('');
    setAvailableDomains(nextDomains);
    setAllowedDomains((prev) => normalizeDomains([...prev, domain]));
    await saveDomains(nextDomains, 'Domain added.');
  };

  const handleRemoveDomain = (domain: string) => {
    setDomainToDelete(domain);
  };

  const confirmRemoveDomain = async () => {
    if (!domainToDelete) return;
    const domain = domainToDelete;
    const nextDomains = availableDomains.filter((item) => item !== domain);
    setAvailableDomains(nextDomains);
    setAllowedDomains((prev) => prev.filter((item) => item !== domain));
    setDomainToDelete(null);
    await saveDomains(nextDomains, 'Domain deleted.');
  };

  const cancelRemoveDomain = () => {
    setDomainToDelete(null);
  };

  const handleCopyDomain = async (domain: string) => {
    try {
      await navigator.clipboard.writeText(domain);
      toast.success('Domain copied to clipboard.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to copy domain.');
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const latestActivityLabel = useMemo(() => {
    if (statsLoading && !stats) {
      return 'Memuat...';
    }
    if (statsError) {
      return 'Gagal memuat';
    }
    if (!stats?.latestReceivedAt) {
      return 'Belum ada email';
    }
    return formatDistanceToNow(new Date(stats.latestReceivedAt), {
      addSuffix: true
    });
  }, [stats, statsError, statsLoading]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/60 text-white">
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-sm uppercase tracking-[0.2em] text-blue-200/70">
                Admin Dashboard
              </p>
              <h1 className="text-3xl font-semibold text-white">
                Pengaturan Telegram Channel
              </h1>
              <p className="text-sm text-white/70">
                Atur bot Telegram untuk mengirim notifikasi inbox baru.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Beranda
            </Link>
          </div>

          <div className="mt-8 grid gap-6">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
                    Statistik Real-time
                  </p>
                  <h2 className="text-lg font-semibold text-white">
                    Aktivitas Inbox
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-200">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  Live
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-widest text-white/50">
                    Inbox Aktif
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {stats?.inboxCount ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-widest text-white/50">
                    Total Pesan
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {stats?.messageCount ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-widest text-white/50">
                    Terakhir Masuk
                  </p>
                  <p className="mt-2 text-base font-semibold text-white">
                    {latestActivityLabel}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Nama Website
                  </h2>
                  <p className="text-sm text-white/60">
                    Nama ini akan tampil di header dan footer.
                  </p>
                </div>
                <Button onClick={saveBranding} disabled={brandingSaving}>
                  {brandingSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Simpan Nama'
                  )}
                </Button>
              </div>
              <div className="mt-4">
                <label className="text-xs font-semibold uppercase tracking-widest text-white/60">
                  Nama Web
                </label>
                <Input
                  value={appName}
                  onChange={(event) => setAppName(event.target.value)}
                  placeholder={DEFAULT_APP_NAME}
                  className="mt-3 bg-black/30 text-white placeholder:text-white/40"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Homepage Private
                  </h2>
                  <p className="text-sm text-white/60">
                    Kunci homepage dengan password agar hanya yang punya akses
                    bisa membuka website.
                  </p>
                </div>
                <Button
                  variant={homepageLockEnabled ? 'default' : 'secondary'}
                  onClick={() => setHomepageLockEnabled((prev) => !prev)}
                >
                  {homepageLockEnabled ? (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Aktif
                    </>
                  ) : (
                    <>
                      <ShieldOff className="mr-2 h-4 w-4" />
                      Nonaktif
                    </>
                  )}
                </Button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-widest text-white/60">
                    Password Homepage
                  </label>
                  <Input
                    type="password"
                    value={homepageLockPassword}
                    onChange={(event) => setHomepageLockPassword(event.target.value)}
                    placeholder="Masukkan password baru"
                    className="mt-3 bg-black/30 text-white placeholder:text-white/40"
                  />
                  <p className="mt-2 text-xs text-white/50">
                    Kosongkan jika tidak ingin mengganti password.
                  </p>
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button
                    onClick={saveHomepageLock}
                    disabled={homepageLockSaving}
                  >
                    {homepageLockSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Simpan Homepage Lock'
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Manajemen Domain
                  </h2>
                  <p className="text-sm text-white/60">
                    Tambahkan domain yang tersedia di aplikasi.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/50">
                  Tambah Domain
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Input
                    value={newDomain}
                    onChange={(event) => setNewDomain(event.target.value)}
                    placeholder="contoh.com"
                    className="h-9 flex-1 bg-black/30 text-white placeholder:text-white/40"
                  />
                  <Button
                    type="button"
                    onClick={handleAddDomain}
                    disabled={domainsSaving || !newDomain.trim()}
                  >
                    {domainsSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah
                      </>
                    )}
                  </Button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {availableDomains.length === 0 ? (
                    <p className="text-sm text-white/50">
                      Belum ada domain tersimpan.
                    </p>
                  ) : (
                    availableDomains.map((domain) => (
                      <div
                        key={domain}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/80"
                      >
                        <span className="font-mono">{domain}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyDomain(domain)}
                            className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveDomain(domain)}
                            className="h-7 w-7 text-white/60 hover:text-red-300 hover:bg-red-400/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Status Notifikasi
                  </h2>
                  <p className="text-sm text-white/60">
                    Aktifkan untuk mengirim notifikasi ke Telegram.
                  </p>
                </div>
                <Button
                  variant={enabled ? 'default' : 'secondary'}
                  onClick={() => setEnabled((prev) => !prev)}
                >
                  {enabled ? (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Aktif
                    </>
                  ) : (
                    <>
                      <ShieldOff className="mr-2 h-4 w-4" />
                      Nonaktif
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-white/60">
                    Bot Token
                  </label>
                  <Input
                    value={botToken}
                    onChange={(event) => setBotToken(event.target.value)}
                    placeholder="123456:ABCDEF..."
                    className="mt-3 bg-black/30 text-white placeholder:text-white/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-white/60">
                    Chat ID / Channel ID
                  </label>
                  <Input
                    value={chatId}
                    onChange={(event) => setChatId(event.target.value)}
                    placeholder="-100xxxxxxxxxx"
                    className="mt-3 bg-black/30 text-white placeholder:text-white/40"
                  />
                </div>
              </div>
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
                  Domain yang dikirim ke Telegram
                </p>
                <p className="mt-2 text-xs text-white/50">
                  Pilih domain yang akan dikirim ke Telegram.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {availableDomains.length === 0 ? (
                    <p className="text-sm text-white/50">
                      Tambahkan domain terlebih dahulu.
                    </p>
                  ) : (
                    availableDomains.map((domain) => {
                      const checked = allowedDomains.includes(domain);
                      return (
                        <label
                          key={domain}
                          className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-purple-400"
                            checked={checked}
                            onChange={() => {
                              setAllowedDomains((prev) =>
                                checked
                                  ? prev.filter((item) => item !== domain)
                                  : [...prev, domain]
                              );
                            }}
                          />
                          <span className="font-mono">{domain}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
              <p className="mt-4 text-xs text-white/50">
                Pastikan bot sudah ditambahkan sebagai admin di channel.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Retensi Global Inbox
                  </h2>
                  <p className="text-sm text-white/60">
                    Semua inbox mengikuti durasi ini.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Clock className="h-4 w-4" />
                  {retentionOptions.find((option) => option.value === retentionSeconds)
                    ?.label || '24 jam'}
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {retentionOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => saveRetention(option.value)}
                    disabled={retentionSaving}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-all ${
                      retentionSeconds === option.value
                        ? 'border-purple-500/50 bg-purple-500/10 text-white'
                        : 'border-white/5 bg-white/[0.02] text-white/70 hover:border-white/10 hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="font-medium">{option.label}</span>
                    {retentionSeconds === option.value && (
                      <span className="rounded-full bg-purple-500/20 px-2 py-1 text-[10px] font-semibold text-purple-200">
                        AKTIF
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

          <div className="flex justify-end">
              <Button onClick={saveSettings} disabled={saving || loading}>
                {saving || loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Simpan'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
      {domainToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={cancelRemoveDomain}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-background p-6 text-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Delete domain</h3>
            <p className="mt-2 text-sm text-white/70">
              Are you sure you want to delete domain{' '}
              <span className="font-mono text-white">{domainToDelete}</span>?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={cancelRemoveDomain}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmRemoveDomain}
                className="bg-red-500/80 text-white hover:bg-red-500"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
