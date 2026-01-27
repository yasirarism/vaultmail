import { NextResponse } from 'next/server';
import { getCollections } from '@/lib/mongodb';
import { RETENTION_SETTINGS_KEY } from '@/lib/admin-auth';

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

export async function GET() {
  const { settings: settingsCollection } = await getCollections();
  const settingsRecord = await settingsCollection.findOne({ key: RETENTION_SETTINGS_KEY });
  const settings = parseSettings(settingsRecord?.value) || {
    seconds: 86400,
    updatedAt: new Date().toISOString()
  };

  return NextResponse.json(settings);
}
