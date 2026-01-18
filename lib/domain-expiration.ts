import { redis } from '@/lib/redis';

const DOMAIN_EXPIRATION_PREFIX = 'domain:expiration:';

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

const fetchExpirationFromRdap = async (domain: string) => {
  try {
    const response = await fetch(`https://rdap.org/domain/${domain}`, {
      headers: {
        'User-Agent': 'VaultMail/1.0 (domain-expiration-check)'
      }
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      events?: Array<{ eventAction?: string; eventDate?: string }>;
    };
    const event = data.events?.find((item) => {
      const action = item.eventAction?.toLowerCase();
      return action === 'expiration' || action === 'expiry' || action === 'expiration date';
    });
    return event?.eventDate || null;
  } catch (error) {
    console.error('RDAP lookup failed:', error);
    return null;
  }
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
