import { MongoClient } from 'mongodb';

type EmailDocument = {
  id: string;
  address: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments: Array<{
    filename?: string;
    contentType?: string;
    contentBase64?: string;
    omitted?: boolean;
    size?: number;
  }>;
  receivedAt: Date;
  read: boolean;
  expireAt: Date;
};

type SettingDocument = {
  key: string;
  value: unknown;
};

type AdminSessionDocument = {
  token: string;
  expiresAt: Date;
};

type DomainExpirationCacheDocument = {
  domain: string;
  expiresAt: string | null;
  checkedAt: string;
  cacheExpiresAt: Date;
};

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'vaultmail';

if (!uri) {
  throw new Error('Missing MONGODB_URI environment variable');
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const client = new MongoClient(uri);
const clientPromise = global._mongoClientPromise ?? client.connect();
global._mongoClientPromise = clientPromise;

let indexesPromise: Promise<void> | null = null;

export const getDb = async () => {
  const mongoClient = await clientPromise;
  return mongoClient.db(dbName);
};

export const ensureIndexes = async () => {
  if (!indexesPromise) {
    indexesPromise = (async () => {
      const db = await getDb();
      await Promise.all([
        db.collection<EmailDocument>('emails').createIndex({ address: 1, receivedAt: -1 }),
        db
          .collection<EmailDocument>('emails')
          .createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
        db
          .collection<SettingDocument>('settings')
          .createIndex({ key: 1 }, { unique: true }),
        db
          .collection<AdminSessionDocument>('adminSessions')
          .createIndex({ token: 1 }, { unique: true }),
        db
          .collection<AdminSessionDocument>('adminSessions')
          .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db
          .collection<DomainExpirationCacheDocument>('domainExpirations')
          .createIndex({ domain: 1 }, { unique: true }),
        db
          .collection<DomainExpirationCacheDocument>('domainExpirations')
          .createIndex({ cacheExpiresAt: 1 }, { expireAfterSeconds: 0 })
      ]);
    })();
  }
  return indexesPromise;
};

export const getCollections = async () => {
  await ensureIndexes();
  const db = await getDb();
  return {
    emails: db.collection<EmailDocument>('emails'),
    settings: db.collection<SettingDocument>('settings'),
    adminSessions: db.collection<AdminSessionDocument>('adminSessions'),
    domainExpirations: db.collection<DomainExpirationCacheDocument>('domainExpirations')
  };
};
