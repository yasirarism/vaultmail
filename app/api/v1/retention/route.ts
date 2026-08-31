import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { RETENTION_SETTINGS_KEY } from '@/lib/admin-auth';
import { authenticateApiRequest } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

type RetentionSettings = { seconds: number; updatedAt: string };

const parseSettings = (value: unknown): RetentionSettings | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as RetentionSettings;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') return value as RetentionSettings;
  return null;
};

export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid API key via Authorization: Bearer <key>' },
      { status: 401 }
    );
  }
  const settingsRaw = await storage.get(RETENTION_SETTINGS_KEY);
  const settings = parseSettings(settingsRaw) || {
    seconds: 86400,
    updatedAt: new Date().toISOString()
  };
  return NextResponse.json(settings);
}