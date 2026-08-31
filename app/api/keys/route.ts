import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { storage } from '@/lib/storage';
import {
  apiKeyUserListKey,
} from '@/lib/api-keys-keys';
import {
  createApiKey,
  getSessionFromRequest,
  hashApiKey,
} from '@/lib/github-auth';

export const dynamic = 'force-dynamic';

type ApiKeyRecord = {
  id: string;
  prefix: string;
  hash: string;
  createdAt: string;
  lastUsedAt: string | null;
};

const parseList = (value: unknown): ApiKeyRecord[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is ApiKeyRecord => Boolean(v && typeof v === 'object'));
};

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Authentication required. Login with GitHub first.' }, { status: 401 });
  }
  const list = parseList(await storage.get(apiKeyUserListKey(session.userId)));
  // Never leak the hash; return public fields only
  return NextResponse.json({
    keys: list.map(({ hash: _hash, ...rest }) => rest),
  });
}

export async function POST(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Authentication required. Login with GitHub first.' }, { status: 401 });
  }
  const { plain, prefix, hash } = await createApiKey();
  const record: ApiKeyRecord = {
    id: randomUUID(),
    prefix,
    hash,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  const list = parseList(await storage.get(apiKeyUserListKey(session.userId)));
  list.push(record);
  await storage.set(apiKeyUserListKey(session.userId), list);

  // Key is shown exactly once, in plain text.
  return NextResponse.json({
    key: plain,
    id: record.id,
    prefix,
    createdAt: record.createdAt,
  });
}
