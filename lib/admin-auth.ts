import { getCollections } from '@/lib/mongodb';

export const ADMIN_SESSION_COOKIE = 'vaultmail_admin_session';
export const TELEGRAM_SETTINGS_KEY = 'settings:telegram';
export const RETENTION_SETTINGS_KEY = 'settings:retention';
export const BRANDING_SETTINGS_KEY = 'settings:branding';

export const isAdminSessionValid = async (token?: string | null) => {
  if (!token) return false;
  const { adminSessions } = await getCollections();
  const record = await adminSessions.findOne({
    token,
    expiresAt: { $gt: new Date() }
  });
  return Boolean(record);
};
