import { NextResponse } from 'next/server';
import {
  buildGoogleAuthUrl,
  createGoogleOAuthState,
  isGoogleAuthConfigured,
} from '@/lib/google-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    if (!(await isGoogleAuthConfigured())) {
      return NextResponse.json(
        { error: 'Google OAuth is not configured on this server.' },
        { status: 503 }
      );
    }
    const state = await createGoogleOAuthState();
    return NextResponse.redirect(await buildGoogleAuthUrl(state, req));
  } catch (error) {
    console.error('Google OAuth start error:', error);
    return NextResponse.json(
      { error: 'Google OAuth is not configured correctly. Check Client ID/Secret in admin panel.' },
      { status: 503 }
    );
  }
}
