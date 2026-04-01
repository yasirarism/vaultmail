import { storage } from '@/lib/storage';
import { BRANDING_SETTINGS_KEY } from '@/lib/admin-auth';
import { DEFAULT_APP_NAME, normalizeAppName } from '@/lib/branding';

type BrandingSettings = {
  appName?: string;
};

const parseBrandingSettings = (value: unknown): BrandingSettings | null => {
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

export const getStoredAppName = async () => {
  if (!process.env.MONGODB_URI) {
    return DEFAULT_APP_NAME;
  }

  const stored = await storage.get(BRANDING_SETTINGS_KEY);
  const settings = parseBrandingSettings(stored);

  return normalizeAppName(settings?.appName) || DEFAULT_APP_NAME;
};
