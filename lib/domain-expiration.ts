import { redis } from '@/lib/redis';

const DOMAIN_EXPIRATION_PREFIX = 'domain:expiration:';
const RDAP_BOOTSTRAP_CACHE_KEY = 'domain:rdap:bootstrap';
const RDAP_BOOTSTRAP_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

type DomainExpirationRecord = {
  domain: string;
  expiresAt: string | null;
  checkedAt: string;
};

type RdapBootstrapCache = {
  services: Array<[string[], string[]]>;
  fetchedAt: string;
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

const parseExpirationEvent = (data: {
  events?: Array<{ eventAction?: string; eventDate?: string }>;
}) => {
  const event = data.events?.find((item) => {
    const action = item.eventAction?.toLowerCase() || '';
    return (
      action === 'expiration' ||
      action === 'expiry' ||
      action === 'expiration date' ||
      action === 'registration expiration date' ||
      action.includes('expir')
    );
  });
  return event?.eventDate || null;
};

const parseBootstrapCache = (value: unknown): RdapBootstrapCache | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as RdapBootstrapCache;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value as RdapBootstrapCache;
  }
  return null;
};

const fetchBootstrap = async () => {
  try {
    const response = await fetch('https://data.iana.org/rdap/dns.json', {
      headers: {
        'User-Agent': 'VaultMail/1.0 (domain-expiration-check)'
      }
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      services?: Array<[string[], string[]]>;
    };
    if (!data.services) return null;
    const record: RdapBootstrapCache = {
      services: data.services,
      fetchedAt: new Date().toISOString()
    };
    try {
      await redis.set(RDAP_BOOTSTRAP_CACHE_KEY, record);
    } catch (error) {
      console.error('RDAP bootstrap cache write failed:', error);
    }
    return record;
  } catch (error) {
    console.error('RDAP bootstrap fetch failed:', error);
    return null;
  }
};

const getBootstrap = async () => {
  try {
    const cachedRaw = await redis.get(RDAP_BOOTSTRAP_CACHE_KEY);
    const cached = parseBootstrapCache(cachedRaw);
    if (cached) {
      const ageMs = Date.now() - new Date(cached.fetchedAt).getTime();
      if (Number.isFinite(ageMs) && ageMs < RDAP_BOOTSTRAP_MAX_AGE_MS) {
        return cached;
      }
    }
  } catch (error) {
    console.error('RDAP bootstrap cache read failed:', error);
  }
  return fetchBootstrap();
};

const getRdapBaseUrls = async (domain: string) => {
  const tld = domain.toLowerCase().split('.').pop();
  if (!tld) return ['https://rdap.org/'];
  const bootstrap = await getBootstrap();
  const services = bootstrap?.services || [];
  const match = services.find(([tlds]) => tlds.map((item) => item.toLowerCase()).includes(tld));
  const urls = match?.[1] || [];
  const fallback = ['https://rdap.org/'];
  const merged = [...urls, ...fallback];
  return merged.filter((value, index) => merged.indexOf(value) === index);
};

const fetchExpirationFromRdap = async (domain: string) => {
  const baseUrls = await getRdapBaseUrls(domain);
  for (const base of baseUrls) {
    try {
      const baseUrl = base.endsWith('/') ? base : `${base}/`;
      const response = await fetch(`${baseUrl}domain/${domain}`, {
        headers: {
          'User-Agent': 'VaultMail/1.0 (domain-expiration-check)'
        }
      });
      if (!response.ok) {
        continue;
      }
      const data = (await response.json()) as {
        events?: Array<{ eventAction?: string; eventDate?: string }>;
      };
      const expiration = parseExpirationEvent(data);
      if (expiration) {
        return expiration;
      }
    } catch (error) {
      console.error('RDAP lookup failed:', error);
    }
  }
  return null;
};

export const getStoredDomainExpiration = async (domain: string) => {
  const key = `${DOMAIN_EXPIRATION_PREFIX}${domain.toLowerCase()}`;
  try {
    const recordRaw = await redis.get(key);
    return parseRecord(recordRaw);
  } catch (error) {
    console.error('Domain expiration cache read failed:', error);
    return null;
  }
};

export const refreshDomainExpiration = async (domain: string) => {
  const expiresAt = await fetchExpirationFromRdap(domain);
  const record: DomainExpirationRecord = {
    domain,
    expiresAt,
    checkedAt: new Date().toISOString()
  };
  const key = `${DOMAIN_EXPIRATION_PREFIX}${domain.toLowerCase()}`;
  try {
    await redis.set(key, record);
  } catch (error) {
    console.error('Domain expiration cache write failed:', error);
  }
  return record;
};
