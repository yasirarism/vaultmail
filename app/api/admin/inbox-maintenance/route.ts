import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { storage } from '@/lib/storage';
import { inboxKey, inboxPattern } from '@/lib/storage-keys';
import {
  ADMIN_SESSION_COOKIE,
  RETENTION_SETTINGS_KEY,
  isAdminSessionValid
} from '@/lib/admin-auth';

type RetentionSettings = {
  seconds: number;
};

const parseRetentionSettings = (value: unknown): RetentionSettings | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as RetentionSettings;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value as RetentionSettings;
  }
  return null;
};

const isAuthorized = async () => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return isAdminSessionValid(sessionToken);
};

const getRetentionSeconds = async () => {
  const raw = await storage.get(RETENTION_SETTINGS_KEY);
  return parseRetentionSettings(raw)?.seconds || 86400;
};

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '');

  if (action === 'cleanup') {
    const keys = (await storage.keys(inboxPattern())) ?? [];
    const retentionSeconds = await getRetentionSeconds();
    const threshold = new Date(Date.now() - retentionSeconds * 1000).toISOString();

    let deleted = 0;
    for (const key of keys) {
      deleted += await storage.ldeleteOlderThanIsoDate(key, threshold);
    }

    return NextResponse.json({
      success: true,
      action,
      deleted,
      scannedInboxes: keys.length
    });
  }

  if (action === 'delete-inbox') {
    const address = String(body?.address || '').trim().toLowerCase();
    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }
    const deleted = await storage.lclear(inboxKey(address));
    await storage.del(inboxKey(address));
    return NextResponse.json({ success: true, action, address, deleted });
  }

  if (action === 'delete-all') {
    const keys = (await storage.keys(inboxPattern())) ?? [];
    let deleted = 0;
    for (const key of keys) {
      deleted += await storage.lclear(key);
      await storage.del(key);
    }
    return NextResponse.json({ success: true, action, deleted });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
