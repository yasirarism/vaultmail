import { storage } from '@/lib/storage';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE,
  THEME_SETTINGS_KEY,
  isAdminSessionValid
} from '@/lib/admin-auth';
import { DEFAULT_THEME, type VisualTheme } from '@/lib/theme';
import { normalizeThemeValue } from '@/lib/theme-settings';

type ThemeSettings = {
  defaultTheme: VisualTheme;
  updatedAt: string;
};

const isAuthorized = async () => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return isAdminSessionValid(sessionToken);
};

type StoredThemeSettings = {
  defaultTheme?: unknown;
  updatedAt?: unknown;
};

const readSettings = async (): Promise<ThemeSettings> => {
  const raw = await storage.get(THEME_SETTINGS_KEY);
  let parsed: StoredThemeSettings | null = null;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as StoredThemeSettings;
    } catch {
      parsed = null;
    }
  } else if (raw && typeof raw === 'object') {
    parsed = raw as StoredThemeSettings;
  }
  return {
    defaultTheme: normalizeThemeValue(parsed?.defaultTheme),
    updatedAt:
      typeof parsed?.updatedAt === 'string'
        ? parsed.updatedAt
        : new Date().toISOString()
  };
};

export async function GET() {
  if (!(await isAuthorized())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  return NextResponse.json(await readSettings());
}

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const defaultTheme = normalizeThemeValue(body?.defaultTheme ?? DEFAULT_THEME);

  const settings: ThemeSettings = {
    defaultTheme,
    updatedAt: new Date().toISOString()
  };

  await storage.set(THEME_SETTINGS_KEY, settings);

  return NextResponse.json(settings);
}
