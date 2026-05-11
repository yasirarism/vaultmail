import { inboxKey } from '@/lib/storage-keys';
import { storage } from '@/lib/storage';
import { NextResponse } from 'next/server';
import { RETENTION_SETTINGS_KEY } from '@/lib/admin-auth';
import { fetchFromImap } from '@/lib/imap-fetch';

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

    const existing = await storage.lrange(inboxKey(address), 0, -1);
    const existingSourceIds = new Set(
      (existing || [])
        .map((item) => (item && typeof item === 'object' ? (item as { sourceId?: string }).sourceId : undefined))
        .filter((value): value is string => Boolean(value))
    );

    const imapEmails = await fetchFromImap(address, existingSourceIds);
    const retentionSeconds = await getRetentionSeconds();
    const thresholdMs = Date.now() - retentionSeconds * 1000;
    const freshImapEmails = imapEmails.filter((email) => {
      const ts = new Date(email.receivedAt).getTime();
      return Number.isFinite(ts) && ts >= thresholdMs;
    });
    if (freshImapEmails.length > 0) {
      for (const email of freshImapEmails) {
        await storage.lpush(inboxKey(address), email);
      }
      await storage.expire(inboxKey(address), retentionSeconds);
    }

    const emails = await storage.lrange(inboxKey(address), 0, -1);
    return NextResponse.json({ emails: emails || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Inbox Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown inbox error';
    return NextResponse.json(
      { emails: [], imapError: true, imapMessage: message, checkedAt: new Date().toISOString() },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
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
