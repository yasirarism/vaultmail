import { redis } from '@/lib/redis';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    const key = `inbox:${address.toLowerCase()}`;
    const emails = await redis.lrange(key, 0, -1);
    return NextResponse.json({ emails: emails || [] });
  } catch (error) {
    console.error('Inbox Error:', error);
    return NextResponse.json({ emails: [] }, { status: 200 });
  }
}
