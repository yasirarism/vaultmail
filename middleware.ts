import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const GUEST_COOKIE = 'vm_guest';

/**
 * Sets an HttpOnly random guest-session cookie for anonymous visitors.
 * The cookie itself is meaningless until the server-action layer lazily
 * registers it in storage, so a guessed/static value is useless.
 * Raw API routes do NOT accept this cookie — they require a GitHub
 * session or an API key (see app/api/inbox/route.ts).
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const existing = req.cookies.get(GUEST_COOKIE)?.value;

  if (!existing) {
    const guestId = crypto.randomUUID();
    res.cookies.set(GUEST_COOKIE, guestId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  return res;
}

export const config = {
  // Run on all routes except static assets, Next internals, and
  // auth/key endpoints (they handle their own auth).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|api/keys|api/v1).*)'],
};
