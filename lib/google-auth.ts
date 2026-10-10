import { randomBytes } from 'crypto';
import { storage } from '@/lib/storage';
import { googleStateKey } from '@/lib/api-keys-keys';
import {
  buildCallbackUri,
  getApiSettings,
  type AuthUser,
} from '@/lib/github-auth';

/**
 * "Sign in with Google" via the OAuth 2.0 Authorization Code flow (OpenID Connect).
 *
 * We use the authorization-code flow rather than the GIS popup / ID-token flow
 * because the client secret never has to touch the browser and the flow works
 * uniformly for web and server-side callers.
 *
 * Session + API-key handling is shared with GitHub: this module only produces a
 * normalised `AuthUser`, which the shared `createSession()` then stores.
 */

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

export const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback';

export const googleClientId = async () => {
  const settings = await getApiSettings();
  return settings.googleClientId || process.env.GOOGLE_CLIENT_ID || '';
};

export const googleClientSecret = async () => {
  const settings = await getApiSettings();
  return settings.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || '';
};

export const isGoogleAuthConfigured = async () =>
  Boolean(await googleClientId()) && Boolean(await googleClientSecret());

export const googleRedirectUri = async (req?: Request) =>
  buildCallbackUri(GOOGLE_CALLBACK_PATH, req);

/** Build the Google consent-screen URL the browser is redirected to. */
export const buildGoogleAuthUrl = async (state: string, req?: Request) => {
  const params = new URLSearchParams({
    client_id: await googleClientId(),
    redirect_uri: await googleRedirectUri(req),
    response_type: 'code',
    // `openid` is required: it is what makes Google return a `sub` claim.
    scope: 'openid email profile',
    state,
    // Always let the user pick which Google account to use.
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
};

export const createGoogleOAuthState = async () => {
  const state = randomBytes(24).toString('hex');
  await storage.set(googleStateKey(state), { used: false }, { ex: 600 });
  return state;
};

/** Single-use state check (CSRF protection for the callback). */
export const consumeGoogleOAuthState = async (state: string) => {
  const record = await storage.get(googleStateKey(state));
  if (!record) return false;
  await storage.del(googleStateKey(state));
  return true;
};

export const exchangeGoogleCodeForToken = async (code: string, req?: Request) => {
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: await googleClientId(),
      client_secret: await googleClientSecret(),
      code,
      grant_type: 'authorization_code',
      redirect_uri: await googleRedirectUri(req),
    }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || 'Google token exchange failed');
  }
  return data.access_token;
};

/**
 * Fetch the profile from Google's OIDC userinfo endpoint.
 *
 * Trust comes from calling Google directly over TLS with an access token that
 * Google itself just issued to this server (authenticated with the client
 * secret) — the browser never supplies identity data, so nothing here is
 * attacker-controlled.
 */
export const fetchGoogleUser = async (accessToken: string): Promise<AuthUser> => {
  const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo failed: HTTP ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string | null;
    picture?: string | null;
  };

  if (!data.sub) throw new Error('Google userinfo failed: no sub in response');
  if (!data.email) throw new Error('Google userinfo failed: no email in response');
  // An unverified email must never be allowed to claim an identity.
  if (data.email_verified === false) {
    throw new Error('Google account email is not verified');
  }

  return {
    // Namespaced so it can never collide with a bare numeric GitHub user id.
    id: `google:${data.sub}`,
    provider: 'google',
    login: data.email,
    name: data.name || null,
    avatar_url: data.picture || null,
  };
};
