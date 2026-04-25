import { inboxKey } from '@/lib/storage-keys';
import { storage } from '@/lib/storage';
import { NextResponse } from 'next/server';
import { RETENTION_SETTINGS_KEY } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

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

const getRetentionSeconds = async () => {
  const raw = await storage.get(RETENTION_SETTINGS_KEY);
  return parseRetentionSettings(raw)?.seconds || 86400;
};

const cleanupExpiredMessages = async (address: string) => {
  const retentionSeconds = await getRetentionSeconds();
  const threshold = new Date(Date.now() - retentionSeconds * 1000).toISOString();
  await storage.ldeleteOlderThanIsoDate(inboxKey(address), threshold);
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    await cleanupExpiredMessages(address);
    const emails = await storage.lrange(inboxKey(address), 0, -1);
    return NextResponse.json({ emails: emails || [] });
  } catch (error) {
    console.error('Inbox Error:', error);
    return NextResponse.json({ emails: [] }, { status: 200 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  const emailId = searchParams.get('emailId');

  if (!address || !emailId) {
    return NextResponse.json(
      { error: 'Address and emailId required' },
      { status: 400 }
    );
  }

  try {
    const deleted = await storage.ldeleteByIds(inboxKey(address), [emailId]);
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('Inbox delete error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
