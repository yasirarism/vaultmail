import { storage } from '@/lib/storage';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE, IMAP_SETTINGS_KEY, isAdminSessionValid } from '@/lib/admin-auth';
import { testImapConnection } from '@/lib/imap-fetch';

type ImapSettings = { enabled: boolean; host: string; port: number; user: string; password: string; mailbox: string; tls: boolean; rejectUnauthorized: boolean; maxFetch: number; domainFilter?: string; updatedAt: string; };
const parseSettings = (value: unknown): ImapSettings | null => {
  if (!value) return null;
  if (typeof value === 'string') { try { return JSON.parse(value) as ImapSettings; } catch { return null; } }
  if (typeof value === 'object') return value as ImapSettings;
  return null;
};
const isAuthorized = async () => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return isAdminSessionValid(sessionToken);
};

export async function GET() {
  if (!(await isAuthorized())) return new NextResponse('Unauthorized', { status: 401 });
  const settingsRaw = await storage.get(IMAP_SETTINGS_KEY);
  const settings = parseSettings(settingsRaw) || { enabled: false, host: '', port: 993, user: '', password: '', mailbox: 'INBOX', tls: true, rejectUnauthorized: true, maxFetch: 30, domainFilter: '', updatedAt: new Date().toISOString() };
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  if (!(await isAuthorized())) return new NextResponse('Unauthorized', { status: 401 });
  const body = await request.json();
  if (body?.action === 'test') {
    try {
      await testImapConnection({
        host: String(body?.host || ''),
        port: Number(body?.port || 993),
        user: String(body?.user || ''),
        password: String(body?.password || ''),
        mailbox: String(body?.mailbox || 'INBOX'),
        tls: body?.tls !== false,
        rejectUnauthorized: body?.rejectUnauthorized !== false
      });
      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'IMAP test failed' }, { status: 400 });
    }
  }

  const settings: ImapSettings = {
    enabled: Boolean(body?.enabled), host: String(body?.host || '').trim(), port: Number(body?.port || 993), user: String(body?.user || '').trim(), password: String(body?.password || '').trim(),
    mailbox: String(body?.mailbox || 'INBOX').trim() || 'INBOX', tls: body?.tls !== false, rejectUnauthorized: body?.rejectUnauthorized !== false, maxFetch: Math.max(1, Math.min(200, Number(body?.maxFetch || 30))),
    domainFilter: String(body?.domainFilter || '').toLowerCase().trim() || undefined, updatedAt: new Date().toISOString()
  };
  await storage.set(IMAP_SETTINGS_KEY, settings);
  return NextResponse.json(settings);
}
