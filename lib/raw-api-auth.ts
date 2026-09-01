import { getSessionFromRequest } from '@/lib/github-auth';
import { authenticateApiRequest } from '@/lib/api-auth';

/**
 * Validates an incoming request for raw API endpoints.
 * Accepts: GitHub session (cookie) OR valid API key (Bearer header).
 * NOTE: the anonymous guest cookie is deliberately NOT accepted here —
 * it only works through server actions (web UI), never raw API access.
 */
export const authorizeRawApi = async (req: Request): Promise<boolean> => {
  const session = await getSessionFromRequest(req);
  if (session) return true;
  const api = await authenticateApiRequest(req);
  return Boolean(api);
};

export const unauthorizedResponse = () =>
  new Response(JSON.stringify({ error: 'Unauthorized. Login via GitHub or provide a valid API key.' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
