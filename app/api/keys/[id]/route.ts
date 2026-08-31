import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { apiKeyUserListKey } from '@/lib/api-keys-keys';
import { getSessionFromRequest } from '@/lib/github-auth';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const { id } = await params;
  const list = (await storage.get(apiKeyUserListKey(session.userId))) as unknown[];
  if (!Array.isArray(list)) {
    return NextResponse.json({ error: 'No keys found.' }, { status: 404 });
  }
  const idx = list.findIndex(
    (k: unknown) => typeof k === 'object' && k && (k as { id?: string }).id === id
  );
  if (idx === -1) {
    return NextResponse.json({ error: 'Key not found.' }, { status: 404 });
  }
  list.splice(idx, 1);
  await storage.set(apiKeyUserListKey(session.userId), list);
  return NextResponse.json({ ok: true });
}