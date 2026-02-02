import { storage } from '@/lib/storage';
import { withPrefix } from '@/lib/storage-keys';

export const ADMIN_SESSION_COOKIE = 'vaultmail_admin_session';
export const ADMIN_SESSION_PREFIX = withPrefix('admin:session:');
export const TELEGRAM_SETTINGS_KEY = withPrefix('settings:telegram');
export const DOMAINS_SETTINGS_KEY = withPrefix('settings:domains');
export const RETENTION_SETTINGS_KEY = withPrefix('settings:retention');
export const BRANDING_SETTINGS_KEY = withPrefix('settings:branding');

export const isAdminSessionValid = async (token?: string | null) => {
  if (!token) return false;
  const exists = await storage.exists(`${ADMIN_SESSION_PREFIX}${token}`);
  return Boolean(exists);
};
