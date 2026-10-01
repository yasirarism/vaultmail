import { storage } from '@/lib/storage';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE,
  THEME_SETTINGS_KEY,
  isAdminSessionValid
} from '@/lib/admin-auth';
import { DEFAULT_THEME, type VisualTheme } from '@/lib/theme';
import { normalizeThemeValue, normalizeThemeVersion } from '@/lib/theme-settings';

type ThemeSettings = {
  defaultTheme: VisualTheme;
  themeVersion: number;
  updatedAt: string;
};

const isAuthorized = async () => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return isAdminSessionValid(sessionToken);
};

type RawThemeSettings = {
  defaultTheme?: unknown;
  themeVersion?: unknown;
  updatedAt?: unknown;
};

const parseRaw = async (): Promise<RawThemeSettings | null> => {
  const raw = await storage.get(THEME_SETTINGS_KEY);
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as RawThemeSettings;
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === 'object') {
    return raw as RawThemeSettings;
  }
  return null;
};

const readSettings = async (): Promise<ThemeSettings> => {
  const parsed = await parseRaw();
  return {
    defaultTheme: normalizeThemeValue(parsed?.defaultTheme),
    themeVersion: normalizeThemeVersion(parsed?.themeVersion),
    updatedAt:
      typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString()
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
  const previous = await parseRaw();

  // Naikkan versi setiap kali tema disimpan (walau nilainya sama) supaya browser
  // pengunjung yang masih memegang preferensi lama ikut berpindah ke tema admin.
  const settings: ThemeSettings = {
    defaultTheme,
    themeVersion: normalizeThemeVersion(previous?.themeVersion) + 1,
    updatedAt: new Date().toISOString()
  };

  await storage.set(THEME_SETTINGS_KEY, settings);

  return NextResponse.json(settings);
}
