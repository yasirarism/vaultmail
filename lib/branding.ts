export const DEFAULT_APP_NAME = 'YS Mail';

export const normalizeAppName = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};
