import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { redis } from '@/lib/redis';
import { ADMIN_SESSION_COOKIE, isAdminSessionValid } from '@/lib/admin-auth';

type InboxEmail = {
  receivedAt?: string;
};

type AdminStats = {
  inboxCount: number;
  messageCount: number;
  latestReceivedAt: string | null;
};

const parseEmail = (value: unknown): InboxEmail | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as InboxEmail;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value as InboxEmail;
  }
  return null;
};

const isAuthorized = async () => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return isAdminSessionValid(sessionToken);
};

export async function GET() {
  if (!(await isAuthorized())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const keys = (await redis.keys('inbox:*')) ?? [];
  const inboxCount = keys.length;

  if (!keys.length) {
    const emptyStats: AdminStats = {
      inboxCount: 0,
      messageCount: 0,
      latestReceivedAt: null
    };
    return NextResponse.json(emptyStats);
  }

  const counts = await Promise.all(keys.map((key) => redis.llen(key)));
  const messageCount = counts.reduce((total, count) => total + count, 0);

  const latestItems = await Promise.all(
    keys.map((key) => redis.lrange(key, 0, 0))
  );
  let latestTimestamp: number | null = null;

  latestItems.forEach((items) => {
    const firstItem = Array.isArray(items) ? items[0] : null;
    const parsed = parseEmail(firstItem);
    if (!parsed?.receivedAt) return;
    const timestamp = new Date(parsed.receivedAt).getTime();
    if (!Number.isNaN(timestamp)) {
      if (latestTimestamp === null || timestamp > latestTimestamp) {
        latestTimestamp = timestamp;
      }
    }
  });

  const stats: AdminStats = {
    inboxCount,
    messageCount,
    latestReceivedAt: latestTimestamp ? new Date(latestTimestamp).toISOString() : null
  };

  return NextResponse.json(stats);
}
