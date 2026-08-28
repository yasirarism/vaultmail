'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

export function AdminLogin() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error || 'Unauthorized');
      }
      toast.success('Login berhasil.');
      window.location.reload();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : 'Password salah atau tidak diizinkan.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen relative flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--brutal-bg)', color: 'var(--text-primary)' }}
    >
      <div className="hero-grid" />
      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        <div className="brutal-card-lg" style={{ padding: '32px 28px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--text-primary)', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Mail className="h-7 w-7" style={{ color: 'var(--brutal-accent)' }} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
            Admin Login
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 24 }}>
            Masukkan password admin untuk mengakses dashboard.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="brutal-input"
                style={{ width: '100%', padding: '12px 40px 12px 14px', fontSize: '0.9rem', outline: 'none' }}
                placeholder="Password admin"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !loading) handleLogin();
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: 'var(--brutal-accent)',
                color: 'var(--brutal-on-accent)',
                border: '2px solid var(--ink)',
                borderRadius: 12,
                fontSize: '0.95rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                boxShadow: 'var(--brutal-shadow)',
                transition: 'transform 0.12s, box-shadow 0.12s',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Masuk'
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}