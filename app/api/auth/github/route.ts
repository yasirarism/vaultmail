import { NextResponse } from 'next/server';
import { createOAuthState, githubClientId, githubRedirectUri } from '@/lib/github-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return NextResponse.json({ error: 'GitHub OAuth is not configured on this server.' }, { status: 503 });
  }
  const state = await createOAuthState();
  const scope = 'read:user user:email';
  const params = new URLSearchParams({
    client_id: githubClientId(),
    redirect_uri: githubRedirectUri(),
    scope,
    state,
    allow_signup: 'true',
  });
  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}
