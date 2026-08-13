export type StoredValue = unknown;

export type StorageAdapter = {
  get(key: string): Promise<StoredValue | null>;
  set(key: string, value: StoredValue, options?: { ex?: number }): Promise<void>;
  exists(key: string): Promise<number>;
  del(key: string): Promise<void>;
  expire(key: string, seconds: number): Promise<void>;
  lpush(key: string, value: StoredValue): Promise<void>;
  lrange(key: string, start: number, end: number): Promise<StoredValue[]>;
  llen(key: string): Promise<number>;
  ldeleteByIds(key: string, ids: string[]): Promise<number>;
  ldeleteOlderThanIsoDate(
    key: string,
    isoDate: string,
    fieldPath?: string
  ): Promise<number>;
  lclear(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
};
