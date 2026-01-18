'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Clock, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

type TelegramSettings = {
  enabled: boolean;
  botToken: string;
  chatId: string;
};

type RetentionSettings = {
  seconds: number;
};

type AdminStats = {
  inboxCount: number;
  messageCount: number;
  latestReceivedAt: string | null;
};

export function AdminDashboard() {
  const [enabled, setEnabled] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [retentionSeconds, setRetentionSeconds] = useState(86400);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(false);

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
      const [telegramResponse, retentionResponse] = await Promise.all([
        fetch('/api/admin/telegram'),
        fetch('/api/admin/retention')
      ]);
      if (!telegramResponse.ok || !retentionResponse.ok) {
        throw new Error('Unauthorized or failed to load settings.');
      }
      const data = (await telegramResponse.json()) as TelegramSettings;
      const retentionData =
        (await retentionResponse.json()) as RetentionSettings;
      setEnabled(Boolean(data.enabled));
      setBotToken(data.botToken || '');
      setChatId(data.chatId || '');
      if (retentionData?.seconds) {
        setRetentionSeconds(retentionData.seconds);
      }
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat setting admin.');
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
      const response = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled,
          botToken,
          chatId
        })
      });
      if (!response.ok) {
        throw new Error('Unauthorized or failed to save settings.');
      }
      toast.success('Setting Telegram tersimpan.');
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan setting Telegram.');
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
      toast.success('Retensi global tersimpan.');
    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan retensi.');
    } finally {
      setRetentionSaving(false);
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
            <Button asChild variant="secondary">
              <Link href="/" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Beranda
              </Link>
            </Button>
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
    </div>
  );
}
