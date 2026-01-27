import { getCollections } from '@/lib/mongodb';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE,
  RETENTION_SETTINGS_KEY,
  isAdminSessionValid
} from '@/lib/admin-auth';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    const isAuthorized = await isAdminSessionValid(sessionToken);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { retentionSeconds } = await req.json();

    if (!retentionSeconds) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const { settings: settingsCollection } = await getCollections();
    await settingsCollection.updateOne(
      { key: RETENTION_SETTINGS_KEY },
      {
        $set: {
          key: RETENTION_SETTINGS_KEY,
          value: {
            seconds: parseInt(retentionSeconds, 10),
            updatedAt: new Date().toISOString()
          }
        }
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
