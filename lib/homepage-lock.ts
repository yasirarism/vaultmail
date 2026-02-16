import { storage } from '@/lib/storage';
import { HOMEPAGE_LOCK_SETTINGS_KEY } from '@/lib/admin-auth';

export const HOMEPAGE_LOCK_COOKIE = 'vaultmail_homepage_auth';

export type HomepageLockSettings = {
  enabled: boolean;
  passwordHash?: string;
  updatedAt?: string;
};

export const hashHomepagePassword = async (password: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

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
