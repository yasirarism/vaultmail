import { getD1DatabaseOrThrow, type D1Database } from '@/lib/cloudflare';
import type { StorageAdapter, StoredValue } from '@/lib/storage-types';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS kv_store (
  id TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER
);
CREATE TABLE IF NOT EXISTS list_meta (
  id TEXT PRIMARY KEY,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_list_items_key_created ON list_items(key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kv_expires ON kv_store(expires_at);
`;

let schemaReady: Promise<void> | null = null;

const ensureSchema = async (db: D1Database) => {
  if (!schemaReady) {
    schemaReady = db.exec(SCHEMA_SQL).then(() => undefined);
  }
  await schemaReady;
};

const getDb = async () => {
  const db = await getD1DatabaseOrThrow();
  await ensureSchema(db);
  return db;
};

const encode = (value: StoredValue) => JSON.stringify(value ?? null);

const decode = (value: string | null | undefined): StoredValue | null => {
  if (value == null) return null;
  try {
    return JSON.parse(value) as StoredValue;
  } catch {
    return value;
  }
};

const isExpired = (expiresAt?: number | null) =>
  Boolean(expiresAt && expiresAt <= Date.now());

const jsonPathFromField = (fieldPath: string) => {
  const normalized = fieldPath.startsWith('value.')
    ? fieldPath.slice('value.'.length)
    : fieldPath;
  return `$.${normalized}`;
};

const patternToLike = (pattern: string) =>
  pattern.replace(/([%_])/g, '\\$1').replace(/\*/g, '%');

const cleanupExpiredList = async (db: D1Database, key: string) => {
  const meta = await db
    .prepare('SELECT expires_at FROM list_meta WHERE id = ?')
    .bind(key)
    .first<{ expires_at: number | null }>();
  if (!meta) return null;
  if (isExpired(meta.expires_at)) {
    await db.batch([
      db.prepare('DELETE FROM list_meta WHERE id = ?').bind(key),
      db.prepare('DELETE FROM list_items WHERE key = ?').bind(key),
    ]);
    return null;
  }
  return meta;
};

const cleanupEmptyListMeta = async (db: D1Database, key: string) => {
  const row = await db
    .prepare('SELECT 1 as found FROM list_items WHERE key = ? LIMIT 1')
    .bind(key)
    .first<{ found: number }>();
  if (!row) {
    await db.prepare('DELETE FROM list_meta WHERE id = ?').bind(key).run();
  }
};

export const createD1Storage = (): StorageAdapter => ({
  async get(key: string) {
    const db = await getDb();
    const row = await db
      .prepare('SELECT value, expires_at FROM kv_store WHERE id = ?')
      .bind(key)
      .first<{ value: string; expires_at: number | null }>();
    if (!row) return null;
    if (isExpired(row.expires_at)) {
      await db.prepare('DELETE FROM kv_store WHERE id = ?').bind(key).run();
      return null;
    }
    return decode(row.value);
  },

  async set(key: string, value: StoredValue, options?: { ex?: number }) {
    const db = await getDb();
    const expiresAt = options?.ex ? Date.now() + options.ex * 1000 : null;
    await db
      .prepare(
        `INSERT INTO kv_store (id, value, expires_at)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`
      )
      .bind(key, encode(value), expiresAt)
      .run();
  },

  async exists(key: string) {
    const db = await getDb();
    const row = await db
      .prepare('SELECT expires_at FROM kv_store WHERE id = ?')
      .bind(key)
      .first<{ expires_at: number | null }>();
    if (!row) return 0;
    if (isExpired(row.expires_at)) {
      await db.prepare('DELETE FROM kv_store WHERE id = ?').bind(key).run();
      return 0;
    }
    return 1;
  },

  async del(key: string) {
    const db = await getDb();
    await db.prepare('DELETE FROM kv_store WHERE id = ?').bind(key).run();
  },

  async expire(key: string, seconds: number) {
    const db = await getDb();
    const expiresAt = Date.now() + seconds * 1000;
    await db.batch([
      db.prepare('UPDATE kv_store SET expires_at = ? WHERE id = ?').bind(expiresAt, key),
      db.prepare('UPDATE list_meta SET expires_at = ? WHERE id = ?').bind(expiresAt, key),
    ]);
  },

  async lpush(key: string, value: StoredValue) {
    const db = await getDb();
    await cleanupExpiredList(db, key);
    const now = Date.now();
    await db.batch([
      db.prepare('INSERT INTO list_items (key, value, created_at) VALUES (?, ?, ?)').bind(
        key,
        encode(value),
        now
      ),
      db.prepare(
        `INSERT INTO list_meta (id, expires_at, created_at, updated_at)
         VALUES (?, NULL, ?, ?)
         ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`
      ).bind(key, now, now),
    ]);
  },

  async lrange(key: string, start: number, end: number) {
    const db = await getDb();
    const meta = await cleanupExpiredList(db, key);
    if (!meta) return [];
    const safeStart = Math.max(0, start);
    let sql = 'SELECT value FROM list_items WHERE key = ? ORDER BY created_at DESC, id DESC';
    const binds: unknown[] = [key];
    if (end >= 0) {
      const limit = Math.max(0, end - safeStart + 1);
      if (limit === 0) return [];
      sql += ' LIMIT ? OFFSET ?';
      binds.push(limit, safeStart);
    } else if (safeStart > 0) {
      sql += ' LIMIT -1 OFFSET ?';
      binds.push(safeStart);
    }
    const result = await db.prepare(sql).bind(...binds).all<{ value: string }>();
    return (result.results || []).map((row) => decode(row.value));
  },

  async llen(key: string) {
    const db = await getDb();
    const meta = await cleanupExpiredList(db, key);
    if (!meta) return 0;
    const row = await db
      .prepare('SELECT COUNT(*) as count FROM list_items WHERE key = ?')
      .bind(key)
      .first<{ count: number }>();
    return Number(row?.count || 0);
  },

  async ldeleteByIds(key: string, ids: string[]) {
    if (ids.length === 0) return 0;
    const db = await getDb();
    const placeholders = ids.map(() => '?').join(', ');
    const result = await db
      .prepare(
        `DELETE FROM list_items WHERE key = ? AND json_extract(value, '$.id') IN (${placeholders})`
      )
      .bind(key, ...ids)
      .run();
    await cleanupEmptyListMeta(db, key);
    return result.meta?.changes ?? 0;
  },

  async ldeleteOlderThanIsoDate(
    key: string,
    isoDate: string,
    fieldPath = 'value.receivedAt'
  ) {
    const db = await getDb();
    const result = await db
      .prepare(
        `DELETE FROM list_items WHERE key = ? AND json_extract(value, ?) < ?`
      )
      .bind(key, jsonPathFromField(fieldPath), isoDate)
      .run();
    await cleanupEmptyListMeta(db, key);
    return result.meta?.changes ?? 0;
  },

  async lclear(key: string) {
    const db = await getDb();
    const result = await db.prepare('DELETE FROM list_items WHERE key = ?').bind(key).run();
    await db.prepare('DELETE FROM list_meta WHERE id = ?').bind(key).run();
    return result.meta?.changes ?? 0;
  },

  async keys(pattern: string) {
    const db = await getDb();
    const like = patternToLike(pattern);
    const result = await db
      .prepare('SELECT id, expires_at FROM list_meta WHERE id LIKE ? ESCAPE ?')
      .bind(like, '\\')
      .all<{ id: string; expires_at: number | null }>();
    const now = Date.now();
    const validKeys: string[] = [];
    const expiredKeys: string[] = [];
    for (const meta of result.results || []) {
      if (meta.expires_at && meta.expires_at <= now) {
        expiredKeys.push(meta.id);
      } else {
        validKeys.push(meta.id);
      }
    }
    if (expiredKeys.length > 0) {
      const placeholders = expiredKeys.map(() => '?').join(', ');
      await db.batch([
        db.prepare(`DELETE FROM list_meta WHERE id IN (${placeholders})`).bind(...expiredKeys),
        db.prepare(`DELETE FROM list_items WHERE key IN (${placeholders})`).bind(...expiredKeys),
      ]);
    }
    return validKeys;
  },
});
