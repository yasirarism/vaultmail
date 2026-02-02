import { redis } from '@/lib/redis';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE,
  DOMAINS_SETTINGS_KEY,
  isAdminSessionValid
} from '@/lib/admin-auth';
import { DEFAULT_DOMAINS } from '@/lib/config';

type DomainsPayload = {
  domains: string[];
};

const normalizeDomains = (domains: string[]) => {
  const normalized = domains
    .map((domain) => domain.toLowerCase().trim())
    .filter(Boolean);
  return [...new Set(normalized)];
};

const parseDomains = (value: unknown): string[] => {
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'object' && value) {
    const payload = value as DomainsPayload;
    if (Array.isArray(payload.domains)) {
      return payload.domains;
    }
  }
  return [];
};

const getEnvDomains = () => normalizeDomains(DEFAULT_DOMAINS);

const isAuthorized = async () => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return isAdminSessionValid(sessionToken);
};

export async function GET() {
  if (!(await isAuthorized())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const storedRaw = await redis.get(DOMAINS_SETTINGS_KEY);
  const storedDomains = normalizeDomains(parseDomains(storedRaw));
  const envDomains = getEnvDomains();
  const mergedDomains = normalizeDomains([...storedDomains, ...envDomains]);

  if (mergedDomains.length > 0) {
    const storedJson = JSON.stringify(storedDomains);
    const mergedJson = JSON.stringify(mergedDomains);
    if (storedJson !== mergedJson) {
      await redis.set(DOMAINS_SETTINGS_KEY, { domains: mergedDomains });
    }
  }

  return NextResponse.json({ domains: mergedDomains });
}

export async function POST(request: Request) {
  if (!(await isAuthorized())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const body = (await request.json()) as DomainsPayload;
  const incoming = Array.isArray(body?.domains) ? body.domains : [];
  const envDomains = getEnvDomains();
  const mergedDomains = normalizeDomains([...incoming, ...envDomains]);

  await redis.set(DOMAINS_SETTINGS_KEY, { domains: mergedDomains });

  return NextResponse.json({ domains: mergedDomains });
}
