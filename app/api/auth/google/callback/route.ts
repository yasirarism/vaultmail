import { NextResponse } from 'next/server';
import {
  consumeGoogleOAuthState,
  exchangeGoogleCodeForToken,
  fetchGoogleUser,
} from '@/lib/google-auth';
import { createSession } from '@/lib/github-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const getBase = (req: Request) => new URL(req.url).origin;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const base = getBase(req);

  // Google reports user-facing failures (e.g. access_denied) as query params.
  const providerError = url.searchParams.get('error');
  if (providerError) {
    return NextResponse.redirect(
      `${base}/api-access?google=error&reason=${encodeURIComponent(providerError)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${base}/api-access?google=error&reason=missing`);
  }

  try {
    const stateOk = await consumeGoogleOAuthState(state);
    if (!stateOk) {
      return NextResponse.redirect(`${base}/api-access?google=error&reason=state`);
    }

    const token = await exchangeGoogleCodeForToken(code, req);
    const user = await fetchGoogleUser(token);
    const session = await createSession(user);

    const res = NextResponse.redirect(`${base}/api-access?google=ok`);
    res.cookies.set('vm_session', session.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Google OAuth callback failed',
        reason: msg,
        hint: 'Biasanya karena: (1) redirect_uri tidak cocok dengan yang didaftarkan di Google Cloud Console, (2) MongoDB/storage tidak terhubung, (3) Client ID/Secret salah.',
      },
      { status: 500 }
    );
  }
}
