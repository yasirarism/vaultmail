import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCollections } from '@/lib/mongodb';
import {
  ADMIN_SESSION_COOKIE,
  RETENTION_SETTINGS_KEY,
  isAdminSessionValid
} from '@/lib/admin-auth';

type RetentionSettings = {
  seconds: number;
  updatedAt: string;
};

const parseSettings = (value: unknown): RetentionSettings | null => {
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

const isAuthorized = async () => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return isAdminSessionValid(sessionToken);
};

export async function GET() {
  if (!(await isAuthorized())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { settings: settingsCollection } = await getCollections();
  const settingsRecord = await settingsCollection.findOne({ key: RETENTION_SETTINGS_KEY });
  const settings = parseSettings(settingsRecord?.value) || {
    seconds: 86400,
    updatedAt: new Date().toISOString()
  };

  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const seconds = Number(body?.seconds || 0);

  if (!seconds) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const settings: RetentionSettings = {
    seconds,
    updatedAt: new Date().toISOString()
  };

  const { settings: settingsCollection } = await getCollections();
  await settingsCollection.updateOne(
    { key: RETENTION_SETTINGS_KEY },
    { $set: { key: RETENTION_SETTINGS_KEY, value: settings } },
    { upsert: true }
  );

  return NextResponse.json(settings);
}
