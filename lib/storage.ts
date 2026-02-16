const uri = process.env.MONGODB_URI || '';
const dbName = process.env.MONGODB_DB || 'vaultmail';
const dataApiUrl = process.env.MONGODB_DATA_API_URL || '';
const dataApiKey = process.env.MONGODB_DATA_API_KEY || '';
const dataApiSource = process.env.MONGODB_DATA_SOURCE || 'Cluster0';

const isEdgeRuntime = () =>
  typeof (globalThis as { EdgeRuntime?: string }).EdgeRuntime !== 'undefined';

type StoredValue = unknown;

type KeyValueDocument = {
  _id: string;
  value: StoredValue;
  expiresAt?: unknown;
};

type ListMetaDocument = {
  _id: string;
  expiresAt?: unknown;
  createdAt: unknown;
  updatedAt: unknown;
};

type ListItemDocument = {
  key: string;
  value: StoredValue;
  createdAt: unknown;
};

const asTimestamp = (value?: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === 'object') {
    const maybeDate = value as { $date?: string | { $numberLong?: string } };
    if (typeof maybeDate.$date === 'string') {
      const parsed = Date.parse(maybeDate.$date);
      return Number.isNaN(parsed) ? null : parsed;
    }
    if (typeof maybeDate.$date === 'object' && maybeDate.$date?.$numberLong) {
      return Number(maybeDate.$date.$numberLong);
    }
  }
  return null;
};

const isExpired = (expiresAt?: unknown) => {
  const ts = asTimestamp(expiresAt);
  return ts != null && ts <= Date.now();
};

const patternToRegex = (pattern: string) => {
  const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
  const regexBody = escaped.replace(/\*/g, '.*');
  return `^${regexBody}$`;
};

const assertDataApiConfig = () => {
  if (!dataApiUrl || !dataApiKey) {
    throw new Error(
      'Edge runtime requires MongoDB Data API. Set MONGODB_DATA_API_URL and MONGODB_DATA_API_KEY.'
    );
  }
};

const dataApi = async <T>(action: string, body: Record<string, unknown>): Promise<T> => {
  assertDataApiConfig();
  const response = await fetch(`${dataApiUrl}/action/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': dataApiKey
    },
    body: JSON.stringify({
      dataSource: dataApiSource,
      database: dbName,
      ...body
    })
  });

  if (!response.ok) {
    throw new Error(`MongoDB Data API request failed (${response.status})`);
  }

  return (await response.json()) as T;
};

let mongoClientPromise: Promise<unknown> | null = null;

const getMongoDb = async () => {
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  if (!mongoClientPromise) {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(uri);
    mongoClientPromise = client.connect();
  }
  const client = (await mongoClientPromise) as { db: (name: string) => unknown };
  return client.db(dbName) as {
    collection: <T>(name: string) => any;
  };
};

const nodeStorage = {
  async get(key: string) {
    const db = await getMongoDb();
    const kv = db.collection<KeyValueDocument>('kv_store');
    const doc = await kv.findOne({ _id: key });
    if (!doc) return null;
    if (isExpired(doc.expiresAt)) {
      await kv.deleteOne({ _id: key });
      return null;
    }
    return doc.value;
  },
  async set(key: string, value: StoredValue, options?: { ex?: number }) {
    const db = await getMongoDb();
    const kv = db.collection<KeyValueDocument>('kv_store');
    const expiresAt = options?.ex ? Date.now() + options.ex * 1000 : null;
    await kv.updateOne({ _id: key }, { $set: { value, expiresAt } }, { upsert: true });
  },
  async exists(key: string) {
    const db = await getMongoDb();
    const kv = db.collection<KeyValueDocument>('kv_store');
    const doc = await kv.findOne({ _id: key }, { projection: { expiresAt: 1 } });
    if (!doc) return 0;
    if (isExpired(doc.expiresAt)) {
      await kv.deleteOne({ _id: key });
      return 0;
    }
    return 1;
  },
  async del(key: string) {
    const db = await getMongoDb();
    await db.collection<KeyValueDocument>('kv_store').deleteOne({ _id: key });
  },
  async expire(key: string, seconds: number) {
    const db = await getMongoDb();
    const expiresAt = Date.now() + seconds * 1000;
    await Promise.all([
      db.collection<KeyValueDocument>('kv_store').updateOne({ _id: key }, { $set: { expiresAt } }),
      db.collection<ListMetaDocument>('list_meta').updateOne({ _id: key }, { $set: { expiresAt } })
    ]);
  },
  async lpush(key: string, value: StoredValue) {
    const db = await getMongoDb();
    const listMeta = db.collection<ListMetaDocument>('list_meta');
    const listItems = db.collection<ListItemDocument>('list_items');
    const meta = await listMeta.findOne({ _id: key });
    if (meta && isExpired(meta.expiresAt)) {
      await Promise.all([listMeta.deleteOne({ _id: key }), listItems.deleteMany({ key })]);
    }
    await listItems.insertOne({ key, value, createdAt: Date.now() });
    const now = Date.now();
    await listMeta.updateOne(
      { _id: key },
      { $set: { updatedAt: now }, $setOnInsert: { createdAt: now, expiresAt: null } },
      { upsert: true }
    );
  },
  async lrange(key: string, start: number, end: number) {
    const db = await getMongoDb();
    const listMeta = db.collection<ListMetaDocument>('list_meta');
    const listItems = db.collection<ListItemDocument>('list_items');
    const meta = await listMeta.findOne({ _id: key });
    if (!meta) return [];
    if (isExpired(meta.expiresAt)) {
      await Promise.all([listMeta.deleteOne({ _id: key }), listItems.deleteMany({ key })]);
      return [];
    }
    const query = listItems.find({ key }).sort({ createdAt: -1, _id: -1 });
    const safeStart = Math.max(0, start);
    if (safeStart > 0) query.skip(safeStart);
    if (end >= 0) {
      const limit = Math.max(0, end - safeStart + 1);
      if (limit === 0) return [];
      query.limit(limit);
    }
    const docs = await query.toArray();
    return docs.map((doc: ListItemDocument) => doc.value);
  },
  async llen(key: string) {
    const db = await getMongoDb();
    const listMeta = db.collection<ListMetaDocument>('list_meta');
    const listItems = db.collection<ListItemDocument>('list_items');
    const meta = await listMeta.findOne({ _id: key });
    if (!meta) return 0;
    if (isExpired(meta.expiresAt)) {
      await Promise.all([listMeta.deleteOne({ _id: key }), listItems.deleteMany({ key })]);
      return 0;
    }
    return listItems.countDocuments({ key });
  },
  async keys(pattern: string) {
    const db = await getMongoDb();
    const listMeta = db.collection<ListMetaDocument>('list_meta');
    const listItems = db.collection<ListItemDocument>('list_items');
    const metas = await listMeta.find({ _id: { $regex: new RegExp(patternToRegex(pattern)) } }).toArray();
    const validKeys: string[] = [];
    const expiredKeys: string[] = [];
    for (const meta of metas) {
      if (isExpired(meta.expiresAt)) expiredKeys.push(meta._id);
      else validKeys.push(meta._id);
    }
    if (expiredKeys.length > 0) {
      await Promise.all([
        listMeta.deleteMany({ _id: { $in: expiredKeys } }),
        listItems.deleteMany({ key: { $in: expiredKeys } })
      ]);
    }
    return validKeys;
  }
};

const edgeStorage = {
  async get(key: string) {
    const result = await dataApi<{ document?: KeyValueDocument }>('findOne', {
      collection: 'kv_store',
      filter: { _id: key }
    });
    const doc = result.document;
    if (!doc) return null;
    if (isExpired(doc.expiresAt)) {
      await dataApi('deleteOne', { collection: 'kv_store', filter: { _id: key } });
      return null;
    }
    return doc.value;
  },
  async set(key: string, value: StoredValue, options?: { ex?: number }) {
    await dataApi('updateOne', {
      collection: 'kv_store',
      filter: { _id: key },
      update: {
        $set: {
          value,
          expiresAt: options?.ex ? Date.now() + options.ex * 1000 : null
        }
      },
      upsert: true
    });
  },
  async exists(key: string) {
    const result = await dataApi<{ document?: Pick<KeyValueDocument, 'expiresAt'> }>('findOne', {
      collection: 'kv_store',
      filter: { _id: key },
      projection: { expiresAt: 1 }
    });
    const doc = result.document;
    if (!doc) return 0;
    if (isExpired(doc.expiresAt)) {
      await dataApi('deleteOne', { collection: 'kv_store', filter: { _id: key } });
      return 0;
    }
    return 1;
  },
  async del(key: string) {
    await dataApi('deleteOne', { collection: 'kv_store', filter: { _id: key } });
  },
  async expire(key: string, seconds: number) {
    const expiresAt = Date.now() + seconds * 1000;
    await Promise.all([
      dataApi('updateOne', {
        collection: 'kv_store',
        filter: { _id: key },
        update: { $set: { expiresAt } }
      }),
      dataApi('updateOne', {
        collection: 'list_meta',
        filter: { _id: key },
        update: { $set: { expiresAt } }
      })
    ]);
  },
  async lpush(key: string, value: StoredValue) {
    const metaResult = await dataApi<{ document?: ListMetaDocument }>('findOne', {
      collection: 'list_meta',
      filter: { _id: key }
    });
    const meta = metaResult.document;
    if (meta && isExpired(meta.expiresAt)) {
      await Promise.all([
        dataApi('deleteOne', { collection: 'list_meta', filter: { _id: key } }),
        dataApi('deleteMany', { collection: 'list_items', filter: { key } })
      ]);
    }

    await dataApi('insertOne', {
      collection: 'list_items',
      document: { key, value, createdAt: Date.now() }
    });

    const now = Date.now();
    await dataApi('updateOne', {
      collection: 'list_meta',
      filter: { _id: key },
      update: {
        $set: { updatedAt: now },
        $setOnInsert: { createdAt: now, expiresAt: null }
      },
      upsert: true
    });
  },
  async lrange(key: string, start: number, end: number) {
    const metaResult = await dataApi<{ document?: ListMetaDocument }>('findOne', {
      collection: 'list_meta',
      filter: { _id: key }
    });
    const meta = metaResult.document;
    if (!meta) return [];
    if (isExpired(meta.expiresAt)) {
      await Promise.all([
        dataApi('deleteOne', { collection: 'list_meta', filter: { _id: key } }),
        dataApi('deleteMany', { collection: 'list_items', filter: { key } })
      ]);
      return [];
    }

    const safeStart = Math.max(0, start);
    const query: Record<string, unknown> = {
      collection: 'list_items',
      filter: { key },
      sort: { createdAt: -1, _id: -1 },
      skip: safeStart
    };
    if (end >= 0) {
      const limit = Math.max(0, end - safeStart + 1);
      if (limit === 0) return [];
      query.limit = limit;
    }

    const result = await dataApi<{ documents: ListItemDocument[] }>('find', query);
    return result.documents.map((doc) => doc.value);
  },
  async llen(key: string) {
    const metaResult = await dataApi<{ document?: ListMetaDocument }>('findOne', {
      collection: 'list_meta',
      filter: { _id: key }
    });
    const meta = metaResult.document;
    if (!meta) return 0;
    if (isExpired(meta.expiresAt)) {
      await Promise.all([
        dataApi('deleteOne', { collection: 'list_meta', filter: { _id: key } }),
        dataApi('deleteMany', { collection: 'list_items', filter: { key } })
      ]);
      return 0;
    }

    const result = await dataApi<{ count: number }>('countDocuments', {
      collection: 'list_items',
      filter: { key }
    });
    return result.count;
  },
  async keys(pattern: string) {
    const result = await dataApi<{ documents: ListMetaDocument[] }>('find', {
      collection: 'list_meta',
      filter: { _id: { $regex: patternToRegex(pattern) } },
      projection: { _id: 1, expiresAt: 1 }
    });

    const validKeys: string[] = [];
    const expiredKeys: string[] = [];
    for (const meta of result.documents) {
      if (isExpired(meta.expiresAt)) expiredKeys.push(meta._id);
      else validKeys.push(meta._id);
    }

    if (expiredKeys.length > 0) {
      await Promise.all([
        dataApi('deleteMany', { collection: 'list_meta', filter: { _id: { $in: expiredKeys } } }),
        dataApi('deleteMany', { collection: 'list_items', filter: { key: { $in: expiredKeys } } })
      ]);
    }

    return validKeys;
  }
};

type StorageAdapter = {
  get: (key: string) => Promise<StoredValue | null>;
  set: (key: string, value: StoredValue, options?: { ex?: number }) => Promise<void>;
  exists: (key: string) => Promise<number>;
  del: (key: string) => Promise<void>;
  expire: (key: string, seconds: number) => Promise<void>;
  lpush: (key: string, value: StoredValue) => Promise<void>;
  lrange: (key: string, start: number, end: number) => Promise<StoredValue[]>;
  llen: (key: string) => Promise<number>;
  keys: (pattern: string) => Promise<string[]>;
};

const backend: StorageAdapter = (isEdgeRuntime() ? edgeStorage : nodeStorage) as StorageAdapter;

export const storage: StorageAdapter = {
  get: backend.get,
  set: backend.set,
  exists: backend.exists,
  del: backend.del,
  expire: backend.expire,
  lpush: backend.lpush,
  lrange: backend.lrange,
  llen: backend.llen,
  keys: backend.keys
};
