import { NextResponse } from 'next/server';
import { destroySession, getSessionFromRequest } from '@/lib/github-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getSessionFromRequest(req);
  if (session) {
    await destroySession(session.id);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set('vm_session', '', { path: '/', maxAge: 0 });
  return res;
}