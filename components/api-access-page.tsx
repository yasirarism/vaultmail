'use client';

import Link from 'next/link';
import { Code2, ExternalLink } from 'lucide-react';

import { AppShell, useAppChrome } from '@/components/app-shell';

export function ApiAccessPage() {
  return (
    <AppShell contentClassName="max-w-6xl">
      <ApiAccessContent />
    </AppShell>
  );
}

function ApiAccessContent() {
  const { t } = useAppChrome();

  return (
    <div className="brutal-card-lg" style={{ padding: '28px 24px', background: 'var(--surface)', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, border: '2px solid var(--ink)', background: 'var(--brutal-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}>
              <Code2 className="h-5 w-5" />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{t.apiAccessTitle}</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', marginTop: 8, maxWidth: 640, fontSize: '0.9rem' }}>
            {t.apiAccessSubtitle}
          </p>
        </div>
        <Link
          href="https://github.com/yasirarism"
          target="_blank"
          rel="noopener noreferrer"
          className="brutal-btn brutal-btn-accent"
          style={{ padding: '10px 18px', fontSize: '0.85rem', alignSelf: 'flex-start' }}
        >
          {t.apiAccessCta}
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="brutal-card" style={{ padding: '18px 16px' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)' }}>
            {t.apiAccessEndpointsTitle}
          </p>
          <ul style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            <li className="brutal-chip" style={{ borderRadius: 8, justifyContent: 'flex-start', padding: '8px 12px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
              GET /api/inbox?address=nama@domain.com
            </li>
            <li className="brutal-chip" style={{ borderRadius: 8, justifyContent: 'flex-start', padding: '8px 12px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
              GET /api/download?address=nama@domain.com&amp;emailId=uuid&amp;type=email
            </li>
            <li className="brutal-chip" style={{ borderRadius: 8, justifyContent: 'flex-start', padding: '8px 12px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
              GET /api/retention
            </li>
          </ul>
        </div>

        <div className="brutal-card" style={{ padding: '18px 16px' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-muted)' }}>
            {t.apiAccessWebhookTitle}
          </p>
          <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            POST /api/webhook
          </p>
          <p style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {t.apiAccessWebhookHint}
          </p>
        </div>
      </div>
    </div>
  );
}
