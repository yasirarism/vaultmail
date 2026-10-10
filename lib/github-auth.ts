import { createHash, randomBytes, randomUUID } from 'crypto';
import { storage } from '@/lib/storage';
import { githubStateKey, sessionKey } from '@/lib/api-keys-keys';
import { API_SETTINGS_KEY } from '@/lib/admin-auth';

export type AuthProvider = 'github' | 'google';

/**
 * A user as returned by an OAuth provider, already normalised.
 *
 * `id` is the value used as the API-key owner id. GitHub keeps its raw numeric
 * id (so existing `apikeys:user:<id>` records stay valid — do NOT change it),
 * while Google is namespaced as `google:<sub>` because Google's `sub` is a bare
 * number that could otherwise collide with a GitHub id.
 */
export type GitHubUser = {
  id: string;
  provider: AuthProvider;
  login: string;
  name: string | null;
  avatar_url: string | null;
};

/** Provider-neutral alias — prefer this name in new code. */
export type AuthUser = GitHubUser;

export type Session = {
  id: string;
  userId: string;
  /** Absent on sessions created before multi-provider support → treat as 'github'. */
  provider?: AuthProvider;
  login: string;
  name: string | null;
  avatar: string | null;
  createdAt: string;
};

export type ApiSettings = {
  githubClientId?: string;
  githubClientSecret?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  appUrl?: string;
  requireApiKey?: boolean;
  updatedAt?: string;
};

const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

export const isGithubAuthConfigured = async () => {
  const settings = await getApiSettings();
  return Boolean(settings.githubClientId && settings.githubClientSecret);
};

export const getApiSettings = async (): Promise<ApiSettings> => {
  try {
    const raw = await storage.get(API_SETTINGS_KEY);
    if (raw && typeof raw === 'object') return raw as ApiSettings;
  } catch (error) {
    console.error('getApiSettings: storage unavailable, falling back to env:', error);
  }
  return {};
};

export const githubClientId = async () => {
  const settings = await getApiSettings();
  return settings.githubClientId || process.env.GITHUB_CLIENT_ID || '';
};

export const githubClientSecret = async () => {
  const settings = await getApiSettings();
  return settings.githubClientSecret || process.env.GITHUB_CLIENT_SECRET || '';
};

/**
 * Build an absolute callback URL for any OAuth provider.
 * Order of preference:
 * 1. appUrl stored in admin settings (or APP_URL env)
 * 2. Auto-detect from the incoming request (Host / x-forwarded-host)
 */
export const buildCallbackUri = async (path: string, req?: Request) => {
  const settings = await getApiSettings();
  const appUrl = settings.appUrl?.trim() || process.env.APP_URL?.trim() || '';

  if (appUrl) {
    return `${appUrl.replace(/\/$/, '')}${path}`;
  }

  // Auto-detect from request
  const host =
    req?.headers.get('x-forwarded-host') ||
    req?.headers.get('host') ||
    'localhost:3000';
  const cleanHost = host.split(',')[0].trim();
  const forwardedProto = req?.headers.get('x-forwarded-proto');
  // Prefer https unless explicitly forwarded as http (and not localhost)
  const proto =
    forwardedProto === 'http' && !cleanHost.includes('localhost') ? 'https' : (forwardedProto || 'https');
  return `${proto}://${cleanHost}${path}`;
};

export const GITHUB_CALLBACK_PATH = '/api/auth/github/callback';

export const githubRedirectUri = async (req?: Request) =>
  buildCallbackUri(GITHUB_CALLBACK_PATH, req);

export const createOAuthState = async () => {
  const state = randomBytes(24).toString('hex');
  await storage.set(githubStateKey(state), { used: false }, { ex: 600 });
  return state;
};

export const consumeOAuthState = async (state: string) => {
  const record = await storage.get(githubStateKey(state));
  if (!record) return false;
  await storage.del(githubStateKey(state));
  return true;
};

export const exchangeCodeForToken = async (code: string, req?: Request) => {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'vaultmail',
    },
    body: JSON.stringify({
      client_id: await githubClientId(),
      client_secret: await githubClientSecret(),
      code,
      redirect_uri: await githubRedirectUri(req),
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(data.error || 'GitHub token exchange failed');
  return data.access_token;
};

export const fetchGitHubUser = async (token: string): Promise<GitHubUser> => {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'vaultmail',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub user fetch failed: HTTP ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as {
    id?: number;
    login?: string;
    name?: string | null;
    avatar_url?: string | null;
  };
  if (!data.id) throw new Error('GitHub user fetch failed: no id in response');
  return {
    // Keep the raw numeric id: existing `apikeys:user:<id>` records depend on it.
    id: String(data.id),
    provider: 'github',
    login: data.login || 'unknown',
    name: data.name || null,
    avatar_url: data.avatar_url || null,
  };
};

export const createSession = async (user: GitHubUser): Promise<Session> => {
  const session: Session = {
    id: randomUUID(),
    userId: user.id,
    provider: user.provider,
    login: user.login,
    name: user.name,
    avatar: user.avatar_url,
    createdAt: new Date().toISOString(),
  };
  await storage.set(sessionKey(session.id), session, { ex: SESSION_TTL });
  return session;
};

export const getSession = async (sessionId?: string | null): Promise<Session | null> => {
  if (!sessionId) return null;
  const record = await storage.get(sessionKey(sessionId));
  if (!record || typeof record !== 'object') return null;
  return record as Session;
};

export const destroySession = async (sessionId?: string | null) => {
  if (!sessionId) return;
  await storage.del(sessionKey(sessionId));
};

export const getSessionFromRequest = async (req: Request): Promise<Session | null> => {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)vm_session=([^;]+)/);
  if (!match) return null;
  return getSession(match[1]);
};

export const createApiKey = async (): Promise<{ plain: string; prefix: string; hash: string }> => {
  const plain = `vm-${randomBytes(24).toString('base64url')}`;
  const prefix = plain.slice(0, 12) + '...';
  const hash = hashApiKey(plain);
  return { plain, prefix, hash };
};

export const hashApiKey = (plain: string) => createHash('sha256').update(plain).digest('hex');

export const apiKeyFromHeader = (req: Request): string | null => {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (match) return match[1].trim();
  const param = new URL(req.url).searchParams.get('api_key');
  return param ? param.trim() : null;
};
