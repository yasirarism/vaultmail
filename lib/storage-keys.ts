export const withPrefix = (key: string) => key;

export const inboxKey = (address: string) =>
  withPrefix(`inbox:${address.toLowerCase()}`);

export const inboxPattern = () => withPrefix('inbox:*');

export const domainExpirationKey = (domain: string) =>
  withPrefix(`domain:expiration:${domain.toLowerCase()}`);
