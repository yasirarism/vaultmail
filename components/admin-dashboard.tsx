'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';

type TelegramSettings = {
  enabled: boolean;
  botToken: string;
  chatId: string;
};

export function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const passwordReady = useMemo(() => password.trim().length > 0, [password]);

  const loadSettings = async () => {
    if (!passwordReady) return;
    setLoading(true);
    try {
      const response = await fetch('/api/admin/telegram', {
        headers: { 'x-admin-password': password }
      });
      if (!response.ok) {
        throw new Error('Unauthorized or failed to load settings.');
      }
      const data = (await response.json()) as TelegramSettings;
      setEnabled(Boolean(data.enabled));
      setBotToken(data.botToken || '');
      setChatId(data.chatId || '');
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat setting Telegram.');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!passwordReady) {
      toast.error('Masukkan password admin dulu.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/admin/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password
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

  useEffect(() => {
    if (passwordReady) {
      loadSettings();
    }
  }, [passwordReady]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/60 text-white">
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg backdrop-blur">
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

          <div className="mt-8 grid gap-6">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <label className="text-xs font-semibold uppercase tracking-widest text-white/60">
                Password Admin
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Masukkan password admin"
                  className="flex-1 bg-black/30 text-white placeholder:text-white/40"
                />
                <Button
                  onClick={loadSettings}
                  disabled={!passwordReady || loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Muat Setting'
                  )}
                </Button>
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

            <div className="flex justify-end">
              <Button onClick={saveSettings} disabled={saving}>
                {saving ? (
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
