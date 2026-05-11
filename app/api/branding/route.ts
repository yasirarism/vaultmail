import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { BRANDING_SETTINGS_KEY } from '@/lib/admin-auth';
import { DEFAULT_APP_NAME, normalizeAppName } from '@/lib/branding';

type BrandingSettings = {
  appName: string;
  headerTitle?: string;
  headerDescription?: string;
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

export async function GET() {
  const settingsRaw = await storage.get(BRANDING_SETTINGS_KEY);
  const settings = parseSettings(settingsRaw);
  const appName = normalizeAppName(settings?.appName) || DEFAULT_APP_NAME;

  return NextResponse.json(
    {
      appName,
      headerTitle: settings?.headerTitle || 'Temp Mail',
      headerDescription:
        settings?.headerDescription ||
        'Spin up secure temporary inboxes in seconds. Bring your own domain or use the default.'
    },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
  );
}
