'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export function AdminLogin() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!password.trim()) {
      toast.error('Masukkan password admin.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!response.ok) {
        throw new Error('Unauthorized');
      }
      toast.success('Login berhasil.');
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast.error('Password salah atau tidak diizinkan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/60 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-6 py-12">
        <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-300">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-semibold">Admin Login</h1>
            <p className="text-sm text-white/70">
              Masukkan password admin untuk mengakses dashboard.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password admin"
              className="bg-black/30 text-white placeholder:text-white/40"
            />
            <Button onClick={handleLogin} disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Masuk'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
