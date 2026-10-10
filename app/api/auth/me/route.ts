import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/github-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({
    user: {
      id: session.userId,
      // Legacy sessions predate multi-provider support; they were all GitHub.
      provider: session.provider || 'github',
      login: session.login,
      name: session.name,
      avatar: session.avatar,
    },
  });
}