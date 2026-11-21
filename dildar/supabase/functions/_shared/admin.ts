// Shared helpers for Dildar Edge Functions (Deno).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

/** Service-role client: bypasses RLS. Only use after checking membership. */
export const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Resolves the calling user from the Authorization header (or null). */
export async function callerId(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

/** Cron-only endpoints require the shared secret stored in Vault + function env. */
export function isCron(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET');
  return !!secret && req.headers.get('x-cron-secret') === secret;
}

export async function membership(userId: string): Promise<{ couple_id: string; partner_id: string | null } | null> {
  const { data: me } = await admin.from('couple_members').select('couple_id').eq('user_id', userId).maybeSingle();
  if (!me) return null;
  const { data: other } = await admin
    .from('couple_members')
    .select('user_id')
    .eq('couple_id', me.couple_id)
    .neq('user_id', userId)
    .maybeSingle();
  return { couple_id: me.couple_id, partner_id: other?.user_id ?? null };
}
