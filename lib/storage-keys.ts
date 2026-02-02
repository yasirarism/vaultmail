const rawPrefix =
  process.env.STORAGE_KEY_PREFIX ||
  process.env.REDIS_KEY_PREFIX ||
  process.env.APP_NAMESPACE ||
  '';
const normalizedPrefix = rawPrefix.trim().replace(/:+$/g, '');
export const keyPrefix = normalizedPrefix ? `${normalizedPrefix}:` : '';

export const withPrefix = (key: string) => `${keyPrefix}${key}`;

export const inboxKey = (address: string) =>
  withPrefix(`inbox:${address.toLowerCase()}`);

export const inboxPattern = () => withPrefix('inbox:*');

export const domainExpirationKey = (domain: string) =>
  withPrefix(`domain:expiration:${domain.toLowerCase()}`);
