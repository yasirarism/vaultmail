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

let warnedMissingMongo = false;

const warnMissingMongo = () => {
  if (warnedMissingMongo) return;
  warnedMissingMongo = true;
  console.warn(
    'MONGODB_URI is not set. Homepage lock is disabled until MongoDB is configured.'
  );
};

export const getHomepageLockSettings = async (): Promise<HomepageLockSettings> => {
  if (!process.env.MONGODB_URI) {
    warnMissingMongo();
    return { enabled: false };
  }
  const storedRaw = await storage.get(HOMEPAGE_LOCK_SETTINGS_KEY);
  const stored = parseHomepageLockSettings(storedRaw);
  if (stored) {
    return stored;
  }

  return { enabled: false };
};
