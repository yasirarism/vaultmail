'use client';

import { useEffect, useMemo, useState } from 'react';
import { Shield, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { DEFAULT_APP_NAME } from '@/lib/branding';

export function HomepageLock() {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customAppName, setCustomAppName] = useState<string | null>(null);

  const resolvedAppName = useMemo(
    () => customAppName || DEFAULT_APP_NAME,
    [customAppName]
  );

  useEffect(() => {
    const wasAuthed = window.localStorage.getItem('vaultmail_homepage_authed');
    if (wasAuthed) {
      toast.error('Your session has expired, please relogin again.');
      window.localStorage.removeItem('vaultmail_homepage_authed');
    }
  }, []);

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim()) {
      toast.error('Password masih kosong.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/homepage-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error || 'Invalid password');
      }
      window.localStorage.setItem('vaultmail_homepage_authed', '1');
      toast.success('Akses diterima. Memuat ulang...');
      window.location.reload();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : 'Password salah atau akses ditolak.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/50 relative overflow-hidden flex flex-col items-center justify-center px-4">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="glass-card w-full max-w-md rounded-3xl border border-white/10 bg-black/40 backdrop-blur-lg p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {resolvedAppName} Private
          </h1>
          <p className="text-sm text-white/60">
            Homepage dikunci. Hubungi owner untuk mendapatkan akses website.
          </p>
          <p className="text-xs text-white/50">
            Masukkan password jika sudah diberikan akses.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-white/60">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pl-10 bg-white/10 border-white/10 text-white placeholder:text-white/40"
                placeholder="Masukkan password"
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-500 text-white hover:bg-blue-400"
          >
            {isSubmitting ? 'Memeriksa...' : 'Buka Akses'}
          </Button>
        </form>
      </div>
    </main>
  );
}
