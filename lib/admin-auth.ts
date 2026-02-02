import { redis } from '@/lib/redis';

export const ADMIN_SESSION_COOKIE = 'vaultmail_admin_session';
export const ADMIN_SESSION_PREFIX = 'admin:session:';
export const TELEGRAM_SETTINGS_KEY = 'settings:telegram';
export const DOMAINS_SETTINGS_KEY = 'settings:domains';
export const RETENTION_SETTINGS_KEY = 'settings:retention';
export const BRANDING_SETTINGS_KEY = 'settings:branding';

export const isAdminSessionValid = async (token?: string | null) => {
  if (!token) return false;
  const exists = await redis.exists(`${ADMIN_SESSION_PREFIX}${token}`);
  return Boolean(exists);
};
