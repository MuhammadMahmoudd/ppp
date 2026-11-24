export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ROOMS: DurableObjectNamespace;
  ASSETS?: Fetcher;
  /** How many accounts this deployment allows (default 2: just the two of you). */
  MAX_USERS?: string;
}
