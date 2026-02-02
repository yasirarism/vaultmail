import { domainExpirationKey } from '@/lib/redis-keys';
import { redis } from '@/lib/redis';
const DOMAIN_EXPIRATION_CACHE_SECONDS = 60 * 60 * 24;
const WHOIS_SEARCH_API_BASE_URL = 'https://whois-search.vercel.app/api/lookup';
const WHOIS_SEARCH_API_HEADERS = {
  accept: 'application/json',
  'user-agent': 'VaultMail/1.0 (domain-expiration-check)'
};

type DomainExpirationRecord = {
  domain: string;
  expiresAt: string | null;
  checkedAt: string;
};


const parseRecord = (value: unknown): DomainExpirationRecord | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as DomainExpirationRecord;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value as DomainExpirationRecord;
  }
  return null;
};

const fetchExpiration = async (domain: string) => {
  return fetchExpirationFromWhoisSearch(domain);
};

const fetchExpirationFromWhoisSearch = async (domain: string) => {
  try {
    const requestUrl = new URL(WHOIS_SEARCH_API_BASE_URL);
    requestUrl.searchParams.set('query', domain);
    const response = await fetch(requestUrl.toString(), {
      redirect: 'follow',
      headers: {
        ...WHOIS_SEARCH_API_HEADERS
      }
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      result?: { expirationDate?: string | null };
    };
    const expirationRaw = data.result?.expirationDate;
    if (!expirationRaw) {
      return null;
    }
    const parsed = new Date(expirationRaw);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString();
  } catch (error) {
    console.error('WHOIS Search API lookup failed:', error);
    return null;
  }
};

export const getStoredDomainExpiration = async (domain: string) => {
  const key = domainExpirationKey(domain);
  try {
    const recordRaw = await redis.get(key);
    return parseRecord(recordRaw);
  } catch (error) {
    console.error('Domain expiration cache read failed:', error);
    return null;
  }
};

export const refreshDomainExpiration = async (domain: string) => {
  const expiresAt = await fetchExpiration(domain);
  const record: DomainExpirationRecord = {
    domain,
    expiresAt,
    checkedAt: new Date().toISOString()
  };
  const key = domainExpirationKey(domain);
  try {
    if (expiresAt) {
      await redis.set(key, record, { ex: DOMAIN_EXPIRATION_CACHE_SECONDS });
    } else {
      await redis.del(key);
    }
  } catch (error) {
    console.error('Domain expiration cache write failed:', error);
  }
  return record;
};
