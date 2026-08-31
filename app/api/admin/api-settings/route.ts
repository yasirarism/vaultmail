import { storage } from '@/lib/storage';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_SETTINGS_KEY, isAdminSessionValid, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';

type ApiSettingsPayload = {
  githubClientId?: string;
  githubClientSecret?: string;
  appUrl?: string;
  requireApiKey?: boolean;
};

const parseSettings = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') return value as Record<string, unknown>;
  return null;
};

const isAuthorized = async () => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return isAdminSessionValid(sessionToken);
};

export async function GET() {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const raw = await storage.get(API_SETTINGS_KEY);
  const settings = parseSettings(raw) || {};
  return NextResponse.json({
    githubClientId: settings.githubClientId || '',
    githubClientSecret: settings.githubClientSecret || '',
    appUrl: settings.appUrl || '',
    requireApiKey: Boolean(settings.requireApiKey),
  });
}

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = (await request.json()) as ApiSettingsPayload;
  const raw = await storage.get(API_SETTINGS_KEY);
  const current = parseSettings(raw) || {};
  const next = {
    ...current,
    githubClientId: body.githubClientId?.trim() || '',
    githubClientSecret: body.githubClientSecret?.trim() || '',
    appUrl: body.appUrl?.trim() || '',
    requireApiKey: Boolean(body.requireApiKey),
    updatedAt: new Date().toISOString(),
  };
  await storage.set(API_SETTINGS_KEY, next);
  return NextResponse.json({ ok: true });
}
