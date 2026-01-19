import { redis } from '@/lib/redis';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE,
  BRANDING_SETTINGS_KEY,
  isAdminSessionValid
} from '@/lib/admin-auth';
import { DEFAULT_APP_NAME, normalizeAppName } from '@/lib/branding';

type BrandingSettings = {
  appName: string;
  updatedAt: string;
};

const parseSettings = (value: unknown): BrandingSettings | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as BrandingSettings;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value as BrandingSettings;
  }
  return null;
};

const isAuthorized = async () => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return isAdminSessionValid(sessionToken);
};

export async function GET() {
  if (!(await isAuthorized())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const settingsRaw = await redis.get(BRANDING_SETTINGS_KEY);
  const settings = parseSettings(settingsRaw);
  const appName = normalizeAppName(settings?.appName) || DEFAULT_APP_NAME;

  return NextResponse.json({
    appName,
    updatedAt: settings?.updatedAt || new Date().toISOString()
  });
}

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const appName = normalizeAppName(body?.appName) || DEFAULT_APP_NAME;

  const settings: BrandingSettings = {
    appName,
    updatedAt: new Date().toISOString()
  };

  await redis.set(BRANDING_SETTINGS_KEY, settings);

  return NextResponse.json(settings);
}
