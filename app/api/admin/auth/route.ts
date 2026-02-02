import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { storage } from '@/lib/storage';
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_PREFIX } from '@/lib/admin-auth';

export async function POST(request: Request) {
  const { password } = await request.json();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || password !== adminPassword) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const token = crypto.randomUUID();
  const key = `${ADMIN_SESSION_PREFIX}${token}`;
  const maxAge = 60 * 60 * 24 * 7;

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
