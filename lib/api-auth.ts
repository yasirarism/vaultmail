import { storage } from '@/lib/storage';
import { apiKeyUserListKey, apiKeyHashKey } from '@/lib/api-keys-keys';
import { hashApiKey, apiKeyFromHeader } from '@/lib/github-auth';

type ApiKeyMatch = {
  userId: string;
  id: string;
  prefix: string;
  lastUsedAt: string | null;
};

/**
 * Look up an API key by its SHA-256 hash.
 *
 * Uses the hash index (apikey:hash:<hash> → {userId, id}) stored in kv_store
 * for O(1) lookup.  This avoids scanning user lists via storage.keys() which
 * only queries the list_meta collection and would miss kv_store keys entirely.
 */
export const findApiKeyByHash = async (hash: string): Promise<ApiKeyMatch | null> => {
  const idx = await storage.get(apiKeyHashKey(hash));
  if (!idx || typeof idx !== 'object') return null;
  const { userId, id } = idx as { userId: string; id: string };
  if (!userId || !id) return null;

  // Fetch the full record from the user's list to get prefix/lastUsedAt.
  const list = (await storage.get(apiKeyUserListKey(userId))) as unknown[];
  if (!Array.isArray(list)) return null;
  for (const item of list) {
    if (typeof item !== 'object' || !item) continue;
    const rec = item as { id?: string; prefix?: string; lastUsedAt?: string | null };
    if (rec.id === id) {
      return { userId, id, prefix: rec.prefix || '', lastUsedAt: rec.lastUsedAt || null };
    }
  }
  return null;
};

export const updateKeyLastUsed = async (userId: string, id: string) => {
  const list = (await storage.get(apiKeyUserListKey(userId))) as unknown[];
  if (!Array.isArray(list)) return;
  for (const item of list) {
    if (typeof item !== 'object' || !item) continue;
    const rec = item as { id?: string; lastUsedAt?: string | null };
    if (rec.id === id) {
      rec.lastUsedAt = new Date().toISOString();
      break;
    }
  }
  await storage.set(apiKeyUserListKey(userId), list);
};

export type ApiAuthResult =
  | { kind: 'session'; userId: string; login: string }
  | { kind: 'apikey'; userId: string; login: string | null }
  | null;

/**
 * Auth for the PUBLIC API (not the web UI):
 * - Accepts `Authorization: Bearer <key>` (OpenAI style) or `?api_key=`.
 * - Optionally accepts a logged-in GitHub session cookie too.
 */
export const authenticateApiRequest = async (req: Request): Promise<ApiAuthResult> => {
  const plain = apiKeyFromHeader(req);
  if (plain) {
    const match = await findApiKeyByHash(hashApiKey(plain));
    if (match) {
      await updateKeyLastUsed(match.userId, match.id).catch(() => {});
      return { kind: 'apikey', userId: match.userId, login: null };
    }
    return null; // invalid key
  }

  const { getSessionFromRequest } = await import('@/lib/github-auth');
  const session = await getSessionFromRequest(req);
  if (session) {
    return { kind: 'session', userId: session.userId, login: session.login };
  }
  return null;
};