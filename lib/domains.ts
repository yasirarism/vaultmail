import { redis } from '@/lib/redis';
import { DOMAINS_SETTINGS_KEY } from '@/lib/admin-auth';
import { DEFAULT_DOMAIN_FALLBACK } from '@/lib/config';

type DomainsPayload = {
  domains: string[];
};

export const normalizeDomains = (domains: string[]) => {
  const normalized = domains
    .map((domain) => domain.toLowerCase().trim())
    .filter(Boolean);
  return [...new Set(normalized)];
};

export const parseDomains = (value: unknown): string[] => {
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

export const getStoredDomains = async () => {
  const storedRaw = await redis.get(DOMAINS_SETTINGS_KEY);
  return normalizeDomains(parseDomains(storedRaw));
};

export const getDomainsWithFallback = async () => {
  const storedDomains = await getStoredDomains();
  if (storedDomains.length > 0) {
    return storedDomains;
  }
  return [DEFAULT_DOMAIN_FALLBACK];
};
