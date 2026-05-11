export const DEFAULT_APP_NAME = 'Temp Mail For Developer';

export const normalizeAppName = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};
