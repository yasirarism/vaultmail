import { NextResponse } from 'next/server';
import {
  consumeOAuthState,
  createSession,
  exchangeCodeForToken,
  fetchGitHubUser,
} from '@/lib/github-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect('/api-access?github=error&reason=missing');
  }

  const stateOk = await consumeOAuthState(state);
  if (!stateOk) {
    return NextResponse.redirect('/api-access?github=error&reason=state');
  }

  try {
    const token = await exchangeCodeForToken(code);
    const user = await fetchGitHubUser(token);
    const session = await createSession(user);

    const res = NextResponse.redirect('/api-access?github=ok');
    res.cookies.set('vm_session', session.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return NextResponse.redirect('/api-access?github=error&reason=token');
  }
}
