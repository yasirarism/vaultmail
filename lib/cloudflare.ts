import { resolveStorageDriver } from '@/lib/runtime';

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
};

export type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown>;
  exec(query: string): Promise<unknown>;
};

type CloudflareEnv = {
  DB?: D1Database;
};

export const getD1Database = async (): Promise<D1Database | null> => {
  if (resolveStorageDriver() !== 'd1') return null;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const context = await getCloudflareContext({ async: true });
    return (context?.env as CloudflareEnv | undefined)?.DB ?? null;
  } catch {
    return null;
  }
};

export const getD1DatabaseOrThrow = async () => {
  const db = await getD1Database();
  if (!db) {
    throw new Error(
      'Cloudflare D1 binding "DB" is missing. Create a D1 database and bind it as DB.'
    );
  }
  return db;
};
