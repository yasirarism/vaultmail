import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { storage } from '@/lib/storage';
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_PREFIX } from '@/lib/admin-auth';
import {
  checkRateLimit,
  registerRateLimitFailure,
  resetRateLimit
} from '@/lib/auth-rate-limit';

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, 'admin-login');
  if (rateLimit.blocked) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan. Coba lagi dalam 5 menit.' },
      { status: 429 }
    );
  }

  const { password } = await request.json();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || password !== adminPassword) {
    const failure = await registerRateLimitFailure(request, 'admin-login');
    if (failure.blocked) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi dalam 5 menit.' },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await resetRateLimit(request, 'admin-login');

  const token = crypto.randomUUID();
  const key = `${ADMIN_SESSION_PREFIX}${token}`;
  const maxAge = 60 * 60;

  await storage.set(key, '1');
  await storage.expire(key, maxAge);

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge
  });

  return response;
}
