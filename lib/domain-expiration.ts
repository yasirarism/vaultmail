import { getCollections } from '@/lib/mongodb';

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
  try {
    const { domainExpirations } = await getCollections();
    const record = await domainExpirations.findOne({ domain: domain.toLowerCase() });
    return parseRecord(record);
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
  try {
    const { domainExpirations } = await getCollections();
    if (expiresAt) {
      await domainExpirations.updateOne(
        { domain: domain.toLowerCase() },
        {
          $set: {
            ...record,
            domain: domain.toLowerCase(),
            cacheExpiresAt: new Date(
              Date.now() + DOMAIN_EXPIRATION_CACHE_SECONDS * 1000
            )
          }
        },
        { upsert: true }
      );
    } else {
      await domainExpirations.deleteOne({ domain: domain.toLowerCase() });
    }
  } catch (error) {
    console.error('Domain expiration cache write failed:', error);
  }
  return record;
};
