const DEFAULT_DOMAIN_FALLBACK = 'ysweb.biz.id';

const normalizeList = (value: string | undefined) => {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      return [];
    }
  }
  return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
};

const envDefaultEmail = process.env.NEXT_PUBLIC_DEFAULT_EMAIL?.trim() || '';
const envDefaultEmailDomain = envDefaultEmail.split('@')[1]?.trim();

export const DEFAULT_DOMAIN =
  process.env.NEXT_PUBLIC_DEFAULT_DOMAIN?.trim() ||
  envDefaultEmailDomain ||
  DEFAULT_DOMAIN_FALLBACK;

export const DEFAULT_DOMAINS = (() => {
  const envDomains = normalizeList(process.env.NEXT_PUBLIC_DEFAULT_DOMAINS);
  if (envDomains.length > 0) {
    return [...new Set(envDomains)];
  }
  return [DEFAULT_DOMAIN];
})();

export const DEFAULT_EMAIL = envDefaultEmail;

export const getDefaultEmailDomain = () => {
  if (!DEFAULT_EMAIL) {
    return DEFAULT_DOMAIN;
  }
  const parts = DEFAULT_EMAIL.split('@');
  return parts.length > 1 && parts[1] ? parts[1] : DEFAULT_DOMAIN;
};
