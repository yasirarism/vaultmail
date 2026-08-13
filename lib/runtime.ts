export type StorageDriver = 'd1' | 'mongo';

const readForcedDriver = (): StorageDriver | null => {
  const value = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (value === 'd1' || value === 'mongo') return value;
  return null;
};

export const isCloudflareRuntime = () => {
  const forced = readForcedDriver();
  if (forced === 'd1') return true;
  if (forced === 'mongo') return false;
  return Boolean(
    process.env.CF_PAGES === '1' ||
      process.env.CF_PAGES_COMMIT_SHA ||
      process.env.CLOUDFLARE_ENV ||
      process.env.CF_WORKER
  );
};

export const isImapSupported = () => !isCloudflareRuntime();

export const resolveStorageDriver = (): StorageDriver => {
  const forced = readForcedDriver();
  if (forced) return forced;
  if (isCloudflareRuntime()) return 'd1';
  return 'mongo';
};

export const getRuntimeInfo = () => {
  const storageDriver = resolveStorageDriver();
  return {
    storageDriver,
    imapSupported: isImapSupported(),
    platform: isCloudflareRuntime() ? 'cloudflare' : 'node',
  };
};
