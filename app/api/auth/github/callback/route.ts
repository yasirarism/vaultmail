import { NextResponse } from 'next/server';
import {
  consumeOAuthState,
  createSession,
  exchangeCodeForToken,
  fetchGitHubUser,
} from '@/lib/github-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const getBase = (req: Request) => new URL(req.url).origin;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const base = getBase(req);

  if (!code || !state) {
    return NextResponse.redirect(`${base}/api-access?github=error&reason=missing`);
  }

  try {
    const stateOk = await consumeOAuthState(state);
    if (!stateOk) {
      return NextResponse.redirect(`${base}/api-access?github=error&reason=state`);
    }

    const token = await exchangeCodeForToken(code, req);
    const user = await fetchGitHubUser(token);
    const session = await createSession(user);

    const res = NextResponse.redirect(`${base}/api-access?github=ok`);
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
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'GitHub OAuth callback failed',
        reason: msg,
        hint: 'Biasanya karena: (1) redirect_uri tidak cocok dengan yang didaftarkan di GitHub OAuth App, (2) MongoDB/storage tidak terhubung, (3) Client ID/Secret salah.',
      },
      { status: 500 }
    );
  }
}