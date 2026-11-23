import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Database } from './database.types';
import { encryptedStorage } from './secureStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const apiConfigured = /^https:\/\/.+/.test(url) && anonKey.length > 20 && !url.includes('YOUR-PROJECT');

export const api: SupabaseClient<Database> = createClient<Database>(
  apiConfigured ? url : 'https://not-configured.invalid',
  apiConfigured ? anonKey : 'not-configured',
  {
    auth: {
      storage: encryptedStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: { params: { eventsPerSecond: 40 } },
  },
);

// Refresh tokens only while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') api.auth.startAutoRefresh();
  else api.auth.stopAutoRefresh();
});

/** Turns a PostgREST/RPC error into a short code we can translate. */
export function errorCode(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const m = String((e as { message: unknown }).message);
    // our SQL raises snake_case codes like "couple_full" / "version_conflict"
    const known = m.match(/\b[a-z]+(?:_[a-z]+)+\b/);
    if (known) return known[0];
    if (/invalid login credentials/i.test(m)) return 'invalid_login';
    if (/network|fetch/i.test(m)) return 'network';
    return m;
  }
  return 'unknown';
}

export const STORAGE_BUCKETS = { snaps: 'snaps', vault: 'vault', chat: 'chat-media', avatars: 'avatars' } as const;
export type Bucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
