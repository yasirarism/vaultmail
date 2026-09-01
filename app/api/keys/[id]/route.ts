import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { apiKeyUserListKey, apiKeyHashKey } from '@/lib/api-keys-keys';
import { getSessionFromRequest, hashApiKey } from '@/lib/github-auth';

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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const { id } = await params;
  const list = parseList(await storage.get(apiKeyUserListKey(session.userId)));
  const idx = list.findIndex((item) => item.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }
  const [removed] = list.splice(idx, 1);
  await storage.set(apiKeyUserListKey(session.userId), list);
  // Also remove the hash index so O(1) lookup won't find it.
  await storage.del(apiKeyHashKey(removed.hash));
  return NextResponse.json({ success: true });
}