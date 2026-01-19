import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const COOKIE_NAME = 'vaultmail_homepage_auth';

export async function POST(req: Request) {
  const homepagePassword = process.env.HOMEPAGE_PASSWORD?.trim();
  if (!homepagePassword) {
    return NextResponse.json(
      { error: 'Homepage lock is not enabled.' },
      { status: 400 }
    );
  }

  const body = (await req.json()) as { password?: string };
  const provided = body?.password?.trim();

  if (!provided) {
    return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
  }

  const expectedHash = crypto
    .createHash('sha256')
    .update(homepagePassword)
    .digest('hex');
  const providedHash = crypto.createHash('sha256').update(provided).digest('hex');

  if (expectedHash !== providedHash) {
    return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, expectedHash, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  });

  return NextResponse.json({ success: true });
}
