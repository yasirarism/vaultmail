import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCollections } from '@/lib/mongodb';
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';

export async function POST(request: Request) {
  const { password } = await request.json();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || password !== adminPassword) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const token = crypto.randomUUID();
  const maxAge = 60 * 60 * 24 * 7;
  const expiresAt = new Date(Date.now() + maxAge * 1000);

  const { adminSessions } = await getCollections();
  await adminSessions.updateOne(
    { token },
    {
      $set: {
        token,
        expiresAt
      }
    },
    { upsert: true }
  );

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
