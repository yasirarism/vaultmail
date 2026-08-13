interface CloudflareEnv {
  DB: D1Database;
  ASSETS?: Fetcher;
  STORAGE_DRIVER?: 'd1' | 'mongo';
}
