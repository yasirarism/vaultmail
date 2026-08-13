interface CloudflareEnv {
  DB: D1Database;
  WORKER_SELF_REFERENCE?: Fetcher;
  ASSETS?: Fetcher;
  STORAGE_DRIVER?: 'd1' | 'mongo';
}
