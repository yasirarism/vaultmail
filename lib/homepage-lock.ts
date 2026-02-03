import crypto from 'crypto';
import { storage } from '@/lib/storage';
import { HOMEPAGE_LOCK_SETTINGS_KEY } from '@/lib/admin-auth';

export const HOMEPAGE_LOCK_COOKIE = 'vaultmail_homepage_auth';

export type HomepageLockSettings = {
  enabled: boolean;
  passwordHash?: string;
  updatedAt?: string;
};

export const hashHomepagePassword = (password: string) =>
  crypto.createHash('sha256').update(password).digest('hex');

export const parseHomepageLockSettings = (
  value: unknown
): HomepageLockSettings | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as HomepageLockSettings;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value as HomepageLockSettings;
  }
  return null;
};

export const getHomepageLockSettings = async (): Promise<HomepageLockSettings> => {
  const storedRaw = await storage.get(HOMEPAGE_LOCK_SETTINGS_KEY);
  const stored = parseHomepageLockSettings(storedRaw);
  if (stored) {
    return stored;
  }

  const envPassword = process.env.HOMEPAGE_PASSWORD?.trim();
  if (envPassword) {
    return {
      enabled: true,
      passwordHash: hashHomepagePassword(envPassword)
    };
  }

  return { enabled: false };
};
