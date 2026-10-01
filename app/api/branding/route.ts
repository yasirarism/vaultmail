import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { BRANDING_SETTINGS_KEY } from '@/lib/admin-auth';
import { DEFAULT_APP_NAME, normalizeAppName } from '@/lib/branding';
import { getStoredThemeSettings } from '@/lib/theme-settings';

type BrandingSettings = {
  appName?: string;
  headerTitle?: string;
  headerDescription?: string;
  announcement?: string;
  updatedAt?: string;
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

export async function GET() {
  const [settingsRaw, themeSettings] = await Promise.all([
    storage.get(BRANDING_SETTINGS_KEY),
    getStoredThemeSettings()
  ]);
  const { defaultTheme, themeVersion } = themeSettings;
  const settings = parseSettings(settingsRaw);
  const appName = normalizeAppName(settings?.appName) || DEFAULT_APP_NAME;

  return NextResponse.json(
    {
      appName,
      headerTitle: settings?.headerTitle || 'Temp Mail',
      headerDescription:
        settings?.headerDescription ||
        'Spin up secure temporary inboxes in seconds. Bring your own domain or use the default.',
      announcement:
        typeof settings?.announcement === 'string'
          ? settings.announcement
          : '',
      defaultTheme,
      themeVersion
    },
    // Tema admin harus segera terlihat di semua browser: jangan cache lama.
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
