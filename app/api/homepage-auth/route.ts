import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getHomepageLockSettings,
  hashHomepagePassword,
  HOMEPAGE_LOCK_COOKIE
} from '@/lib/homepage-lock';

export async function POST(req: Request) {
  const settings = await getHomepageLockSettings();
  if (!settings.enabled || !settings.passwordHash) {
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

  const expectedHash = settings.passwordHash;
  const providedHash = hashHomepagePassword(provided);

  if (expectedHash !== providedHash) {
    return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(HOMEPAGE_LOCK_COOKIE, expectedHash, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  });

  return NextResponse.json({ success: true });
}
