import { readEnv } from '@/lib/env';

const uri = readEnv('MONGODB_URI') || '';
const dbName = readEnv('MONGODB_DB') || 'vaultmail';

type MongoClient = import('mongodb').MongoClient;
type MongoDb = import('mongodb').Db;
type D1DatabaseLike = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = Record<string, unknown>>() => Promise<T | null>;
      run: () => Promise<unknown>;
      all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
    };
    first: <T = Record<string, unknown>>() => Promise<T | null>;
    run: () => Promise<unknown>;
    all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  };
  batch: (statements: unknown[]) => Promise<unknown>;
};

let clientPromise: Promise<MongoClient> | null = null;
let d1Promise: Promise<D1DatabaseLike | null> | null = null;
let d1ReadyPromise: Promise<void> | null = null;

let warnedMissingMongo = false;
let warnedMongoConnectionFailure = false;
let warnedMissingD1 = false;
let warnedD1Failure = false;

const warnMissingMongo = () => {
  if (warnedMissingMongo || uri) return;
  warnedMissingMongo = true;
  console.warn('MONGODB_URI is not set. Falling back to non-Mongo storage mode.');
};

const warnMongoConnectionFailure = (error: unknown) => {
  if (warnedMongoConnectionFailure) return;
  warnedMongoConnectionFailure = true;
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`MongoDB connection failed. Falling back to non-Mongo storage mode. ${message}`);
};

const warnMissingD1 = () => {
  if (warnedMissingD1) return;
  warnedMissingD1 = true;
  console.warn('Cloudflare D1 binding `DB` is not available.');
};

const warnD1Failure = (error: unknown) => {
  if (warnedD1Failure) return;
  warnedD1Failure = true;
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`D1 storage failed. ${message}`);
};

const getClient = () => {
  if (!uri) {
    return null;
  }
  if (!clientPromise) {
    clientPromise = (async () => {
      const { MongoClient } = await import('mongodb');
      const client = new MongoClient(uri);
      return client.connect();
    })();
  }
  return clientPromise;
};

const getMongoDb = async (): Promise<MongoDb | null> => {
  try {
    const client = await getClient();
    if (!client) {
      warnMissingMongo();
      return null;
    }
    return client.db(dbName);
  } catch (error) {
    warnMongoConnectionFailure(error);
    return null;
  }
};

const getD1Db = async (): Promise<D1DatabaseLike | null> => {
  if (!d1Promise) {
    d1Promise = (async () => {
      try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const context = await getCloudflareContext({ async: true });
        const db = (context?.env as Record<string, unknown> | undefined)?.DB as
          | D1DatabaseLike
          | undefined;
        if (!db) {
          warnMissingD1();
          return null;
        }
        return db;
      } catch {
        warnMissingD1();
        return null;
      }
    })();
  }

  const db = await d1Promise;
  if (!db) return null;

  if (!d1ReadyPromise) {
    d1ReadyPromise = (async () => {
      try {
        await db.batch([
          db.prepare(`CREATE TABLE IF NOT EXISTS kv_store (
            key TEXT PRIMARY KEY,
            value_json TEXT NOT NULL,
            expires_at INTEGER
          )`),
          db.prepare(`CREATE TABLE IF NOT EXISTS list_meta (
            key TEXT PRIMARY KEY,
            expires_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          )`),
          db.prepare(`CREATE TABLE IF NOT EXISTS list_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            list_key TEXT NOT NULL,
            value_json TEXT NOT NULL,
            created_at INTEGER NOT NULL
          )`),
          db.prepare('CREATE INDEX IF NOT EXISTS idx_list_items_key_created ON list_items(list_key, created_at DESC, id DESC)'),
          db.prepare('CREATE INDEX IF NOT EXISTS idx_list_meta_expires ON list_meta(expires_at)')
        ]);
      } catch (error) {
        warnD1Failure(error);
        throw error;
      }
    })();
  }

  try {
    await d1ReadyPromise;
    return db;
  } catch {
    return null;
  }
};

type StoredValue = unknown;

type KeyValueDocument = {
  _id: string;
  value: StoredValue;
  expiresAt?: Date | null;
};

type ListMetaDocument = {
  _id: string;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ListItemDocument = {
  key: string;
  value: StoredValue;
  createdAt: Date;
};

const nowMs = () => Date.now();

const isExpired = (expiresAt?: Date | null) =>
  Boolean(expiresAt && expiresAt.getTime() <= nowMs());

const cleanupExpiredListMongo = async (key: string) => {
  const db = await getMongoDb();
  if (!db) return null;
  const listMeta = db.collection<ListMetaDocument>('list_meta');
  const listItems = db.collection<ListItemDocument>('list_items');
  const meta = await listMeta.findOne({ _id: key });
  if (meta && isExpired(meta.expiresAt)) {
    await Promise.all([
      listMeta.deleteOne({ _id: key }),
      listItems.deleteMany({ key })
    ]);
    return null;
  }
  return meta;
};

const cleanupExpiredListD1 = async (db: D1DatabaseLike, key: string) => {
  const meta = await db
    .prepare('SELECT expires_at FROM list_meta WHERE key = ?')
    .bind(key)
    .first<{ expires_at?: number | null }>();
  if (meta?.expires_at && meta.expires_at <= nowMs()) {
    await db.batch([
      db.prepare('DELETE FROM list_meta WHERE key = ?').bind(key),
      db.prepare('DELETE FROM list_items WHERE list_key = ?').bind(key)
    ]);
    return null;
  }
  return meta ?? null;
};

const patternToRegex = (pattern: string) => {
  const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
  const regexBody = escaped.replace(/\*/g, '.*');
  return new RegExp(`^${regexBody}$`);
};

const patternToSqlLike = (pattern: string) => pattern.replace(/\*/g, '%');

const parseJson = <T = StoredValue>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const getActiveBackend = async () => {
  const preferred = readEnv('STORAGE_BACKEND')?.toLowerCase();
  const d1 = await getD1Db();
  if (preferred === 'd1' && d1) return { kind: 'd1' as const, d1 };
  if (preferred === 'mongodb') {
    const mongo = await getMongoDb();
    if (mongo) return { kind: 'mongodb' as const, mongo };
  }

  if (d1) return { kind: 'd1' as const, d1 };

  const mongo = await getMongoDb();
  if (mongo) return { kind: 'mongodb' as const, mongo };

  return { kind: 'none' as const };
};

export const storage = {
  async get(key: string) {
    const backend = await getActiveBackend();
    if (backend.kind === 'd1') {
      const row = await backend.d1
        .prepare('SELECT value_json, expires_at FROM kv_store WHERE key = ?')
        .bind(key)
        .first<{ value_json: string; expires_at?: number | null }>();
      if (!row) return null;
      if (row.expires_at && row.expires_at <= nowMs()) {
        await backend.d1.prepare('DELETE FROM kv_store WHERE key = ?').bind(key).run();
        return null;
      }
      return parseJson(row.value_json);
    }

    if (backend.kind === 'mongodb') {
      const kv = backend.mongo.collection<KeyValueDocument>('kv_store');
      const doc = await kv.findOne({ _id: key });
      if (!doc) return null;
      if (isExpired(doc.expiresAt)) {
        await kv.deleteOne({ _id: key });
        return null;
      }
      return doc.value;
    }

    return null;
  },

  async set(key: string, value: StoredValue, options?: { ex?: number }) {
    const backend = await getActiveBackend();
    const expiresAtMs = options?.ex ? nowMs() + options.ex * 1000 : null;

    if (backend.kind === 'd1') {
      await backend.d1
        .prepare('INSERT OR REPLACE INTO kv_store (key, value_json, expires_at) VALUES (?, ?, ?)')
        .bind(key, JSON.stringify(value), expiresAtMs)
        .run();
      return;
    }

    if (backend.kind === 'mongodb') {
      const kv = backend.mongo.collection<KeyValueDocument>('kv_store');
      const expiresAt = expiresAtMs ? new Date(expiresAtMs) : null;
      await kv.updateOne({ _id: key }, { $set: { value, expiresAt } }, { upsert: true });
    }
  },

  async exists(key: string) {
    const backend = await getActiveBackend();

    if (backend.kind === 'd1') {
      const row = await backend.d1
        .prepare('SELECT expires_at FROM kv_store WHERE key = ?')
        .bind(key)
        .first<{ expires_at?: number | null }>();
      if (!row) return 0;
      if (row.expires_at && row.expires_at <= nowMs()) {
        await backend.d1.prepare('DELETE FROM kv_store WHERE key = ?').bind(key).run();
        return 0;
      }
      return 1;
    }

    if (backend.kind === 'mongodb') {
      const kv = backend.mongo.collection<KeyValueDocument>('kv_store');
      const doc = await kv.findOne({ _id: key }, { projection: { expiresAt: 1 } });
      if (!doc) return 0;
      if (isExpired(doc.expiresAt)) {
        await kv.deleteOne({ _id: key });
        return 0;
      }
      return 1;
    }

    return 0;
  },

  async del(key: string) {
    const backend = await getActiveBackend();
    if (backend.kind === 'd1') {
      await backend.d1.prepare('DELETE FROM kv_store WHERE key = ?').bind(key).run();
      return;
    }
    if (backend.kind === 'mongodb') {
      const kv = backend.mongo.collection<KeyValueDocument>('kv_store');
      await kv.deleteOne({ _id: key });
    }
  },

  async expire(key: string, seconds: number) {
    const backend = await getActiveBackend();
    const expiresAtMs = nowMs() + seconds * 1000;

    if (backend.kind === 'd1') {
      await backend.d1.batch([
        backend.d1.prepare('UPDATE kv_store SET expires_at = ? WHERE key = ?').bind(expiresAtMs, key),
        backend.d1.prepare('UPDATE list_meta SET expires_at = ? WHERE key = ?').bind(expiresAtMs, key)
      ]);
      return;
    }

    if (backend.kind === 'mongodb') {
      const kv = backend.mongo.collection<KeyValueDocument>('kv_store');
      const listMeta = backend.mongo.collection<ListMetaDocument>('list_meta');
      const expiresAt = new Date(expiresAtMs);
      await Promise.all([
        kv.updateOne({ _id: key }, { $set: { expiresAt } }),
        listMeta.updateOne({ _id: key }, { $set: { expiresAt } })
      ]);
    }
  },

  async lpush(key: string, value: StoredValue) {
    const backend = await getActiveBackend();

    if (backend.kind === 'd1') {
      await cleanupExpiredListD1(backend.d1, key);
      const now = nowMs();
      await backend.d1.batch([
        backend.d1
          .prepare('INSERT INTO list_items (list_key, value_json, created_at) VALUES (?, ?, ?)')
          .bind(key, JSON.stringify(value), now),
        backend.d1
          .prepare(`INSERT INTO list_meta (key, expires_at, created_at, updated_at)
            VALUES (?, NULL, ?, ?)
            ON CONFLICT(key) DO UPDATE SET updated_at=excluded.updated_at`)
          .bind(key, now, now)
      ]);
      return;
    }

    if (backend.kind === 'mongodb') {
      const listMeta = backend.mongo.collection<ListMetaDocument>('list_meta');
      const listItems = backend.mongo.collection<ListItemDocument>('list_items');
      await cleanupExpiredListMongo(key);
      await listItems.insertOne({ key, value, createdAt: new Date() });
      const now = new Date();
      await listMeta.updateOne(
        { _id: key },
        {
          $set: { updatedAt: now },
          $setOnInsert: { createdAt: now, expiresAt: null }
        },
        { upsert: true }
      );
    }
  },

  async lrange(key: string, start: number, end: number) {
    const backend = await getActiveBackend();

    if (backend.kind === 'd1') {
      const meta = await cleanupExpiredListD1(backend.d1, key);
      if (!meta) return [];
      const safeStart = Math.max(0, start);
      const limit = end >= 0 ? Math.max(0, end - safeStart + 1) : -1;
      if (end >= 0 && limit === 0) return [];
      const query =
        end >= 0
          ? backend.d1
              .prepare('SELECT value_json FROM list_items WHERE list_key = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?')
              .bind(key, limit, safeStart)
          : backend.d1
              .prepare('SELECT value_json FROM list_items WHERE list_key = ? ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET ?')
              .bind(key, safeStart);
      const rows = await query.all<{ value_json: string }>();
      return rows.results
        .map((row) => parseJson(row.value_json))
        .filter((value): value is StoredValue => value !== null);
    }

    if (backend.kind === 'mongodb') {
      const listItems = backend.mongo.collection<ListItemDocument>('list_items');
      const meta = await cleanupExpiredListMongo(key);
      if (!meta) return [];
      const query = listItems.find({ key }).sort({ createdAt: -1, _id: -1 });
      const safeStart = Math.max(0, start);
      if (safeStart > 0) {
        query.skip(safeStart);
      }
      if (end >= 0) {
        const limit = Math.max(0, end - safeStart + 1);
        if (limit === 0) return [];
        query.limit(limit);
      }
      const docs = await query.toArray();
      return docs.map((doc) => doc.value);
    }

    return [];
  },

  async llen(key: string) {
    const backend = await getActiveBackend();

    if (backend.kind === 'd1') {
      const meta = await cleanupExpiredListD1(backend.d1, key);
      if (!meta) return 0;
      const row = await backend.d1
        .prepare('SELECT COUNT(*) as count FROM list_items WHERE list_key = ?')
        .bind(key)
        .first<{ count: number }>();
      return Number(row?.count ?? 0);
    }

    if (backend.kind === 'mongodb') {
      const listItems = backend.mongo.collection<ListItemDocument>('list_items');
      const meta = await cleanupExpiredListMongo(key);
      if (!meta) return 0;
      return listItems.countDocuments({ key });
    }

    return 0;
  },

  async keys(pattern: string) {
    const backend = await getActiveBackend();

    if (backend.kind === 'd1') {
      const now = nowMs();
      const likePattern = patternToSqlLike(pattern);
      const rows = await backend.d1
        .prepare('SELECT key, expires_at FROM list_meta WHERE key LIKE ?')
        .bind(likePattern)
        .all<{ key: string; expires_at?: number | null }>();

      const validKeys: string[] = [];
      const expiredKeys: string[] = [];

      for (const row of rows.results) {
        if (row.expires_at && row.expires_at <= now) {
          expiredKeys.push(row.key);
        } else {
          validKeys.push(row.key);
        }
      }

      if (expiredKeys.length > 0) {
        for (const key of expiredKeys) {
          await backend.d1.batch([
            backend.d1.prepare('DELETE FROM list_meta WHERE key = ?').bind(key),
            backend.d1.prepare('DELETE FROM list_items WHERE list_key = ?').bind(key)
          ]);
        }
      }

      return validKeys;
    }

    if (backend.kind === 'mongodb') {
      const listMeta = backend.mongo.collection<ListMetaDocument>('list_meta');
      const listItems = backend.mongo.collection<ListItemDocument>('list_items');
      const regex = patternToRegex(pattern);
      const metas = await listMeta.find({ _id: { $regex: regex } }).toArray();
      const now = nowMs();
      const validKeys: string[] = [];
      const expiredKeys: string[] = [];
      for (const meta of metas) {
        if (meta.expiresAt && meta.expiresAt.getTime() <= now) {
          expiredKeys.push(meta._id);
        } else {
          validKeys.push(meta._id);
        }
      }
      if (expiredKeys.length > 0) {
        await Promise.all([
          listMeta.deleteMany({ _id: { $in: expiredKeys } }),
          listItems.deleteMany({ key: { $in: expiredKeys } })
        ]);
      }
      return validKeys;
    }

    return [];
  }
};
