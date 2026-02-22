export const readEnv = (key: string): string | undefined => {
  if (typeof process === 'undefined') {
    return undefined;
  }

  return process.env?.[key];
};

export const hasEnv = (key: string): boolean => {
  const value = readEnv(key);
  return Boolean(value && value.trim().length > 0);
};
