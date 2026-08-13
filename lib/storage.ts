import { resolveStorageDriver } from '@/lib/runtime';
import type { StorageAdapter } from '@/lib/storage-types';

let adapterPromise: Promise<StorageAdapter> | null = null;

const loadAdapter = async (): Promise<StorageAdapter> => {
  if (resolveStorageDriver() === 'd1') {
    const { createD1Storage } = await import('@/lib/storage-d1');
    return createD1Storage();
  }
  const { createMongoStorage } = await import('@/lib/storage-mongo');
  return createMongoStorage();
};

const getAdapter = () => {
  if (!adapterPromise) {
    adapterPromise = loadAdapter();
  }
  return adapterPromise;
};

export const storage: StorageAdapter = {
  async get(key) {
    return (await getAdapter()).get(key);
  },
  async set(key, value, options) {
    return (await getAdapter()).set(key, value, options);
  },
  async exists(key) {
    return (await getAdapter()).exists(key);
  },
  async del(key) {
    return (await getAdapter()).del(key);
  },
  async expire(key, seconds) {
    return (await getAdapter()).expire(key, seconds);
  },
  async lpush(key, value) {
    return (await getAdapter()).lpush(key, value);
  },
  async lrange(key, start, end) {
    return (await getAdapter()).lrange(key, start, end);
  },
  async llen(key) {
    return (await getAdapter()).llen(key);
  },
  async ldeleteByIds(key, ids) {
    return (await getAdapter()).ldeleteByIds(key, ids);
  },
  async ldeleteOlderThanIsoDate(key, isoDate, fieldPath) {
    return (await getAdapter()).ldeleteOlderThanIsoDate(key, isoDate, fieldPath);
  },
  async lclear(key) {
    return (await getAdapter()).lclear(key);
  },
  async keys(pattern) {
    return (await getAdapter()).keys(pattern);
  },
};

export const isStorageConfigured = async () => {
  if (resolveStorageDriver() === 'd1') {
    const { getD1Database } = await import('@/lib/cloudflare');
    return Boolean(await getD1Database());
  }
  return Boolean(process.env.MONGODB_URI);
};
