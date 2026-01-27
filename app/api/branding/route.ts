import { NextResponse } from 'next/server';
import { getCollections } from '@/lib/mongodb';
import { BRANDING_SETTINGS_KEY } from '@/lib/admin-auth';
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

export async function GET() {
  const { settings: settingsCollection } = await getCollections();
  const settingsRecord = await settingsCollection.findOne({ key: BRANDING_SETTINGS_KEY });
  const settings = parseSettings(settingsRecord?.value);
  const appName = normalizeAppName(settings?.appName) || DEFAULT_APP_NAME;

  return NextResponse.json({ appName });
}
