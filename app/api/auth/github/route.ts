import { NextResponse } from 'next/server';
import { createOAuthState, githubClientId, githubRedirectUri, isGithubAuthConfigured } from '@/lib/github-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    if (!(await isGithubAuthConfigured())) {
      return NextResponse.json({ error: 'GitHub OAuth is not configured on this server.' }, { status: 503 });
    }
    const state = await createOAuthState();
    const scope = 'read:user user:email';
    const redirectUri = await githubRedirectUri(req);
    const params = new URLSearchParams({
      client_id: await githubClientId(),
      redirect_uri: redirectUri,
      scope,
      state,
      allow_signup: 'true',
    });
    return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  } catch (error) {
    console.error('GitHub OAuth start error:', error);
    return NextResponse.json(
      { error: 'GitHub OAuth is not configured correctly. Check Client ID/Secret in admin panel.' },
      { status: 503 }
    );
  }
}