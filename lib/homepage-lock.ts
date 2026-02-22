import { storage } from '@/lib/storage';
import { HOMEPAGE_LOCK_SETTINGS_KEY } from '@/lib/admin-auth';
import { hasEnv } from '@/lib/env';

export const HOMEPAGE_LOCK_COOKIE = 'vaultmail_homepage_auth';

export type HomepageLockSettings = {
  enabled: boolean;
  passwordHash?: string;
  updatedAt?: string;
};

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');

export const hashHomepagePassword = async (password: string) => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(password)
  );

  return toHex(new Uint8Array(digest));
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
  if (!hasEnv('MONGODB_URI')) {
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
