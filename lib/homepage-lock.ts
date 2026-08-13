import crypto from 'crypto';
import { storage, isStorageConfigured } from '@/lib/storage';
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

let warnedMissingStorage = false;

const warnMissingStorage = () => {
  if (warnedMissingStorage) return;
  warnedMissingStorage = true;
  console.warn(
    'Persistent storage is not configured. Homepage lock stays disabled until D1 or MongoDB is available.'
  );
};

export const getHomepageLockSettings = async (): Promise<HomepageLockSettings> => {
  if (!(await isStorageConfigured())) {
    warnMissingStorage();
    return { enabled: false };
  }
  const storedRaw = await storage.get(HOMEPAGE_LOCK_SETTINGS_KEY);
  const stored = parseHomepageLockSettings(storedRaw);
  if (stored) {
    return stored;
  }

  return { enabled: false };
};
