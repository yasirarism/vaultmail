'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Code2, ExternalLink, Github, Key, Copy, Trash2, Check, Loader2, LogOut, Play, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell, useAppChrome } from '@/components/app-shell';

export function ApiAccessPage() {
  return (
    <AppShell contentClassName="max-w-6xl">
      <ApiAccessContent />
    </AppShell>
  );
}

type ApiKey = { id: string; prefix: string; createdAt: string; lastUsedAt: string | null };
type User = { id: string; login: string; name: string | null; avatar: string | null };

function ApiAccessContent() {
  const { t } = useAppChrome();
  const [user, setUser] = useState<User | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newKeyPlain, setNewKeyPlain] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ===== API Tester state =====
  const [testerKey, setTesterKey] = useState('');
  const [testerEndpoint, setTesterEndpoint] = useState('/api/v1/inbox');
  const [testerParams, setTesterParams] = useState('address=nama@domain.com');
  const [testerResponse, setTesterResponse] = useState<{ status: number; body: string; durationMs: number } | null>(null);
  const [testerLoading, setTesterLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, keysRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/keys'),
        ]);
        if (meRes.ok) {
          const meData = (await meRes.json()) as { user: User | null };
          setUser(meData.user);
        }
        if (keysRes.ok) {
          const keysData = (await keysRes.json()) as { keys: ApiKey[] };
          setKeys(keysData.keys);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setNewKeyPlain(null);
    try {
      const res = await fetch('/api/keys', { method: 'POST' });
      if (res.status === 401) {
        window.location.href = '/api/auth/github';
        return;
      }
      if (!res.ok) {
        toast.error('Failed to generate API key');
        return;
      }
      const data = (await res.json()) as { key: string; id: string; prefix: string; createdAt: string };
      setNewKeyPlain(data.key);
      setKeys((prev) => [...prev, { id: data.id, prefix: data.prefix, createdAt: data.createdAt, lastUsedAt: null }]);
    } catch { toast.error('Failed to generate API key'); }
    setGenerating(false);
  };

  const handleRevoke = async (id: string) => {
    const res = await fetch(`/api/keys/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success('API key revoked');
    } else {
      toast.error('Failed to revoke key');
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copied!');
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setKeys([]);
    toast.success('Logged out');
  };

  // ===== API Tester =====
  const getOrigin = () => {
    if (typeof window !== 'undefined') return window.location.origin;
    return process.env.APP_URL || '';
  };

  const buildTesterUrl = () => {
    const base = getOrigin();
    const trimmed = testerParams.trim();
    return `${base}${testerEndpoint}${trimmed ? (testerEndpoint.includes('?') ? '&' : '?') + trimmed : ''}`;
  };

  const handleTest = async () => {
    setTesterLoading(true);
    setTesterResponse(null);
    const startedAt = performance.now();
    try {
      const url = buildTesterUrl();
      const headers: Record<string, string> = {};
      if (testerKey.trim()) {
        headers.Authorization = `Bearer ${testerKey.trim()}`;
      }
      const res = await fetch(url, { headers, cache: 'no-store' });
      const durationMs = Math.round(performance.now() - startedAt);
      const text = await res.text();
      let body = text;
      try { body = JSON.stringify(JSON.parse(text), null, 2); } catch { /* not JSON */ }
      setTesterResponse({ status: res.status, body, durationMs });
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      setTesterResponse({
        status: 0,
        body: error instanceof Error ? error.message : 'Request failed',
        durationMs,
      });
    } finally {
      setTesterLoading(false);
    }
  };

  const AUTO_ADD = '?address=nama@domain.com';

  return (    <div className="brutal-card-lg" style={{ padding: '28px 24px', background: 'var(--surface)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, border: '2px solid var(--ink)', background: 'var(--brutal-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brutal-on-accent)' }}>
            <Code2 className="h-5 w-5" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{t.apiAccessTitle}</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', maxWidth: 640, fontSize: '0.9rem' }}>
          {t.apiAccessSubtitle}
        </p>
      </div>

      {/* ========== GitHub Auth ========== */}
      <div className="brutal-card" style={{ padding: '16px 18px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Github className="h-5 w-5" style={{ color: 'var(--text-primary)' }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                {user ? `GitHub: ${user.login}` : 'GitHub Authentication'}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {user ? 'Login via GitHub' : 'Required to generate and manage API keys'}
              </p>
            </div>
          </div>
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              className="brutal-btn brutal-btn-white"
              style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          ) : (
            <Link
              href="/api/auth/github"
              className="brutal-btn brutal-btn-accent"
              style={{ padding: '6px 14px', fontSize: '0.78rem', textDecoration: 'none' }}
            >
              <Github className="h-3.5 w-3.5" />
              Login with GitHub
            </Link>
          )}
        </div>
      </div>

      {/* ========== API Keys ========== */}
      {user && (
        <div className="brutal-card" style={{ padding: '16px 18px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
              <Key className="h-3.5 w-3.5" style={{ display: 'inline', marginRight: 4 }} />
              API Keys
            </p>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="brutal-btn brutal-btn-accent"
              style={{ padding: '6px 14px', fontSize: '0.78rem', opacity: generating ? 0.7 : 1 }}
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />}
              Generate New Key
            </button>
          </div>

          {/* Key shown once */}
          {newKeyPlain && (
            <div style={{ padding: '12px 14px', borderRadius: 10, border: '2px solid var(--brutal-accent)', background: 'var(--brutal-accent-light)', marginBottom: 12, fontSize: '0.82rem' }}>
              <p style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>⚠️ Key created — copy it now. You won't see it again!</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', background: 'var(--surface)', border: '1px solid var(--ink)', borderRadius: 8, padding: '8px 10px', wordBreak: 'break-all' }}>
                <span style={{ flex: 1, color: 'var(--text-primary)' }}>{newKeyPlain}</span>
                <button type="button" onClick={() => handleCopy(newKeyPlain, 'new')} style={{ flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--brutal-accent)' }}>
                  {copiedId === 'new' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <button type="button" onClick={() => setNewKeyPlain(null)} style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)', border: 'none', background: 'none', cursor: 'pointer' }}>Dismiss</button>
            </div>
          )}

          {keys.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '12px 0', fontStyle: 'italic' }}>
              No API keys yet. Generate one above.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {keys.map((key) => (
                <div key={key.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--ink)', background: 'var(--brutal-bg)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{key.prefix}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                      {new Date(key.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button type="button" onClick={() => handleRevoke(key.id)} title="Revoke key" style={{ flexShrink: 0, border: '2px solid var(--ink)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== OpenAI-style API Docs ========== */}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {/* Endpoints */}
        <div className="brutal-card" style={{ padding: '18px 16px' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: 4 }}>
            Endpoints
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <div className="brutal-chip" style={{ borderRadius: 8, justifyContent: 'flex-start', padding: '10px 12px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--brutal-accent)', fontWeight: 800 }}>GET</span>{' '}
              <span style={{ color: 'var(--text-primary)' }}>/api/v1/inbox?address=nama@domain.com</span>
            </div>
            <div className="brutal-chip" style={{ borderRadius: 8, justifyContent: 'flex-start', padding: '10px 12px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--brutal-accent)', fontWeight: 800 }}>GET</span>{' '}
              <span style={{ color: 'var(--text-primary)' }}>/api/v1/download?address=nama@domain.com&amp;emailId=uuid&amp;type=email</span>
            </div>
            <div className="brutal-chip" style={{ borderRadius: 8, justifyContent: 'flex-start', padding: '10px 12px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--brutal-accent)', fontWeight: 800 }}>GET</span>{' '}
              <span style={{ color: 'var(--text-primary)' }}>/api/v1/retention</span>
            </div>
            <div className="brutal-chip" style={{ borderRadius: 8, justifyContent: 'flex-start', padding: '10px 12px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--brutal-accent)', fontWeight: 800 }}>DELETE</span>{' '}
              <span style={{ color: 'var(--text-primary)' }}>/api/v1/inbox?address=nama@domain.com&amp;emailId=uuid</span>
            </div>
          </div>
        </div>

        {/* Authentication */}
        <div className="brutal-card" style={{ padding: '18px 16px' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: 4 }}>
            Authentication
          </p>
          <p style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
            All API requests require an API key passed in the <code style={{ background: 'var(--brutal-bg)', padding: '2px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>Authorization</code> header:
          </p>
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--brutal-bg)', border: '1px solid var(--ink)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
            <span style={{ color: 'var(--text-muted)' }}># Replace with your API key</span><br />
            curl -H "Authorization: Bearer sk-vm-xxx..." \<br />
            &nbsp;&nbsp;https://yourdomain.com/api/inbox?address=user@example.com
          </div>
          <p style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Generate an API key above by logging in with GitHub.
          </p>
        </div>

        {/* Webhook */}
        <div className="brutal-card" style={{ padding: '18px 16px' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: 4 }}>
            Webhook
          </p>
          <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            POST /api/webhook
          </p>
          <p style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {t.apiAccessWebhookHint}
          </p>
        </div>
      </div>

      {/* ========== API Tester (Playground) ========== */}
      <div className="brutal-card" style={{ padding: '20px 18px', marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Terminal className="h-4 w-4" style={{ color: 'var(--brutal-accent)' }} />
          <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>API Tester</p>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14 }}>
          Preview request &amp; response untuk endpoint public API. Masukkan API key-mu untuk autentikasi.
        </p>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {/* API key input */}
          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
              API Key
            </label>
            <input
              type="password"
              value={testerKey}
              onChange={(e) => setTesterKey(e.target.value)}
              placeholder="vm-xxxxxxxx..."
              style={{ width: '100%', marginTop: 6, padding: '8px 10px', borderRadius: 8, border: '2px solid var(--ink)', background: 'var(--surface)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
            />
            {user && keys.length > 0 && (
              <button
                type="button"
                onClick={() => setTesterKey(keys[0].prefix)}
                style={{ marginTop: 6, fontSize: '0.7rem', color: 'var(--brutal-accent)', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                (prefix key pertama)
              </button>
            )}
          </div>

          {/* Endpoint select */}
          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
              Endpoint
            </label>
            <select
              value={testerEndpoint}
              onChange={(e) => {
                const v = e.target.value;
                setTesterEndpoint(v);
                if (v === '/api/v1/inbox') setTesterParams('address=nama@domain.com');
                else if (v === '/api/v1/retention') setTesterParams('');
                else if (v === '/api/v1/download') setTesterParams('address=nama@domain.com&emailId=uuid&type=email');
              }}
              style={{ width: '100%', marginTop: 6, padding: '8px 10px', borderRadius: 8, border: '2px solid var(--ink)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '0.78rem' }}
            >
              <option value="/api/v1/inbox">GET /api/v1/inbox</option>
              <option value="/api/v1/retention">GET /api/v1/retention</option>
              <option value="/api/v1/download">GET /api/v1/download</option>
            </select>
          </div>

          {/* Query params */}
          <div>
            <label style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
              Query Params
            </label>
            <input
              type="text"
              value={testerParams}
              onChange={(e) => setTesterParams(e.target.value)}
              placeholder="address=nama@domain.com"
              style={{ width: '100%', marginTop: 6, padding: '8px 10px', borderRadius: 8, border: '2px solid var(--ink)', background: 'var(--surface)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
            />
          </div>
        </div>

        {/* Full URL preview */}
        <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--brutal-bg)', border: '1px solid var(--ink)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
          <span style={{ color: 'var(--text-muted)' }}># Request</span><br />
          curl -H "Authorization: Bearer {testerKey.trim() || 'vm-xxx...'}"<br />
          &nbsp;&nbsp;{buildTesterUrl()}
        </div>

        {/* Send button */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={handleTest}
            disabled={testerLoading}
            className="brutal-btn brutal-btn-accent"
            style={{ padding: '8px 18px', fontSize: '0.82rem', opacity: testerLoading ? 0.7 : 1 }}
          >
            {testerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {testerLoading ? 'Sending...' : 'Send Request'}
          </button>
          {testerResponse && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {testerResponse.durationMs}ms
            </span>
          )}
        </div>

        {/* Response */}
        {testerResponse && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  padding: '2px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800,
                  background: testerResponse.status >= 200 && testerResponse.status < 300 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                  color: testerResponse.status >= 200 && testerResponse.status < 300 ? '#22c55e' : '#ef4444',
                  border: '1px solid var(--ink)',
                }}
              >
                HTTP {testerResponse.status || 'ERR'}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {testerResponse.durationMs}ms
              </span>
            </div>
            <pre style={{ margin: 0, padding: '12px 14px', borderRadius: 8, background: 'var(--brutal-bg)', border: '1px solid var(--ink)', fontSize: '0.74rem', color: 'var(--text-primary)', overflowX: 'auto', maxHeight: 320, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {testerResponse.body}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}