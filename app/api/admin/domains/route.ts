import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE,
  DOMAINS_SETTINGS_KEY,
  isAdminSessionValid
} from '@/lib/admin-auth';
import { redis } from '@/lib/redis';
import { getStoredDomains, normalizeDomains } from '@/lib/domains';

type DomainsPayload = {
  domains: string[];
};

const isAuthorized = async () => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return isAdminSessionValid(sessionToken);
};

export async function GET() {
  if (!(await isAuthorized())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const storedDomains = await getStoredDomains();

  return NextResponse.json({ domains: storedDomains });
}

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const body = (await request.json()) as DomainsPayload;
  const incoming = Array.isArray(body?.domains) ? body.domains : [];
  const normalized = normalizeDomains(incoming);

  await redis.set(DOMAINS_SETTINGS_KEY, { domains: normalized });

  return NextResponse.json({ domains: normalized });
}
