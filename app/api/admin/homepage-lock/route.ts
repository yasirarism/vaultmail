import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE,
  HOMEPAGE_LOCK_SETTINGS_KEY,
  isAdminSessionValid
} from '@/lib/admin-auth';
import {
  getHomepageLockSettings,
  hashHomepagePassword
} from '@/lib/homepage-lock';
import { storage } from '@/lib/storage';

type HomepageLockPayload = {
  enabled: boolean;
  hasPassword: boolean;
  updatedAt: string;
};

type HomepageLockSettingsPayload = HomepageLockPayload & {
  password?: string;
};

const isAuthorized = async () => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return isAdminSessionValid(sessionToken);
};

const ensureMongoAvailable = () => {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: 'MONGODB_URI is not set. Configure MongoDB to use homepage lock.' },
      { status: 500 }
    );
  }
  return null;
};

export async function GET() {
  if (!(await isAuthorized())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const mongoGuard = ensureMongoAvailable();
  if (mongoGuard) {
    return mongoGuard;
  }

  const settings = await getHomepageLockSettings();

  return NextResponse.json({
    enabled: Boolean(settings.enabled),
    hasPassword: Boolean(settings.passwordHash),
    updatedAt: settings.updatedAt || new Date().toISOString()
  });
}

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const mongoGuard = ensureMongoAvailable();
  if (mongoGuard) {
    return mongoGuard;
  }

  const body = (await request.json()) as HomepageLockSettingsPayload;
  const enabled = Boolean(body?.enabled);
  const password = body?.password?.trim();

  const settings = await getHomepageLockSettings();
  const nextPasswordHash = password
    ? hashHomepagePassword(password)
    : settings.passwordHash;

  if (enabled && !nextPasswordHash) {
    return NextResponse.json(
      { error: 'Password is required when enabling the lock.' },
      { status: 400 }
    );
  }

  const nextSettings = {
    enabled,
    passwordHash: nextPasswordHash,
    updatedAt: new Date().toISOString()
  };

  await storage.set(HOMEPAGE_LOCK_SETTINGS_KEY, nextSettings);

  return NextResponse.json({
    enabled: nextSettings.enabled,
    hasPassword: Boolean(nextSettings.passwordHash),
    updatedAt: nextSettings.updatedAt
  });
}
