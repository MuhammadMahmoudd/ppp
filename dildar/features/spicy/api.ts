/**
 * Spicy Hub data access. Private answers (YNM, body map) are written to
 * author-only tables; anything the partner may see comes from the
 * SECURITY DEFINER match/reveal RPCs. Free text is E2E-encrypted.
 */
import { api } from '@/lib/api';
import { sealString, tryOpenString } from '@/lib/crypto';
import type { BodyMapRow, FantasyListRow, Heat, TrySoonRow, YnmAnswer } from '@/lib/database.types';
import type { Intensity, RegionId } from './bodyRegions';

const throwIf = (e: unknown) => {
  if (e) throw e;
};

// ─── Yes / No / Maybe ───────────────────────────────────────────────────────
export async function loadMyAnswers(userId: string): Promise<Record<string, YnmAnswer>> {
  const { data, error } = await api.from('ynm_answers').select('item_key, answer').eq('user_id', userId);
  throwIf(error);
  return Object.fromEntries((data ?? []).map((r) => [r.item_key, r.answer]));
}

export async function setAnswer(coupleId: string, key: string, answer: YnmAnswer | null): Promise<void> {
  if (answer === null) {
    const { error } = await api.from('ynm_answers').delete().eq('item_key', key);
    throwIf(error);
    return;
  }
  const { error } = await api
    .from('ynm_answers')
    .upsert({ couple_id: coupleId, item_key: key, answer, updated_at: new Date().toISOString() }, { onConflict: 'user_id,item_key' });
  throwIf(error);
}

export type CustomItem = { id: string; key: string; text: string; mine: boolean };

export async function loadCustomItems(userId: string, sharedKey: Uint8Array | null): Promise<CustomItem[]> {
  const { data, error } = await api.from('ynm_items').select('*').order('created_at');
  throwIf(error);
  return (data ?? [])
    .map((r) => ({ id: r.id, key: r.id, text: tryOpenString(r.text_ciphertext, r.nonce, sharedKey) ?? '', mine: r.created_by === userId }))
    .filter((i) => i.text);
}

export async function addCustomItem(coupleId: string, text: string, sharedKey: Uint8Array): Promise<void> {
  const s = sealString(text.trim(), sharedKey);
  const { error } = await api.from('ynm_items').insert({ couple_id: coupleId, category: 'custom', text_ciphertext: s.c, nonce: s.n });
  throwIf(error);
}

export async function deleteCustomItem(id: string): Promise<void> {
  const { error } = await api.from('ynm_items').delete().eq('id', id);
  throwIf(error);
  await api.from('ynm_answers').delete().eq('item_key', id);
}

export type Match = { key: string; mine: YnmAnswer; theirs: YnmAnswer; strength: 'both_yes' | 'yes_maybe' };

export async function loadMatches(): Promise<Match[]> {
  const { data, error } = await api.rpc('ynm_matches');
  throwIf(error);
  return (data ?? [])
    .map((m) => ({
      key: m.item_key,
      mine: m.my_answer,
      theirs: m.partner_answer,
      strength: (m.my_answer === 'yes' && m.partner_answer === 'yes' ? 'both_yes' : 'yes_maybe') as Match['strength'],
    }))
    .sort((a, b) => (a.strength === b.strength ? 0 : a.strength === 'both_yes' ? -1 : 1));
}

export async function loadTrySoon(): Promise<TrySoonRow[]> {
  const { data, error } = await api.from('ynm_try_soon').select('*').order('added_at', { ascending: false });
  throwIf(error);
  return data ?? [];
}

export async function addTrySoon(coupleId: string, key: string): Promise<void> {
  const { error } = await api.from('ynm_try_soon').upsert({ couple_id: coupleId, item_key: key }, { onConflict: 'couple_id,item_key', ignoreDuplicates: true });
  throwIf(error);
}

export async function markTrySoonDone(coupleId: string, key: string, done: boolean): Promise<void> {
  const { error } = await api
    .from('ynm_try_soon')
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq('couple_id', coupleId)
    .eq('item_key', key);
  throwIf(error);
}

export async function removeTrySoon(coupleId: string, key: string): Promise<void> {
  const { error } = await api.from('ynm_try_soon').delete().eq('couple_id', coupleId).eq('item_key', key);
  throwIf(error);
}

// ─── boundaries check-in ────────────────────────────────────────────────────
export async function lastCheckin(userId: string): Promise<string | null> {
  const { data, error } = await api.from('boundary_checkins').select('at').eq('user_id', userId).order('at', { ascending: false }).limit(1);
  throwIf(error);
  return data?.[0]?.at ?? null;
}

export async function recordCheckin(coupleId: string): Promise<void> {
  const { error } = await api.from('boundary_checkins').insert({ couple_id: coupleId });
  throwIf(error);
}

// ─── body map ───────────────────────────────────────────────────────────────
export type Side = 'mine' | 'yours';
export type BodyAnswers = Record<Side, Partial<Record<RegionId, Intensity>>>;

export async function loadBodyMap(userId: string): Promise<BodyAnswers> {
  const { data, error } = await api.from('body_map_answers').select('side, area, intensity').eq('user_id', userId);
  throwIf(error);
  const out: BodyAnswers = { mine: {}, yours: {} };
  for (const r of (data ?? []) as Pick<BodyMapRow, 'side' | 'area' | 'intensity'>[]) out[r.side][r.area as RegionId] = r.intensity;
  return out;
}

export async function setBodyArea(coupleId: string, side: Side, area: RegionId, intensity: Intensity): Promise<void> {
  if (intensity === 0) {
    const { error } = await api.from('body_map_answers').delete().eq('side', side).eq('area', area);
    throwIf(error);
    return;
  }
  const { error } = await api
    .from('body_map_answers')
    .upsert({ couple_id: coupleId, side, area, intensity, updated_at: new Date().toISOString() }, { onConflict: 'user_id,side,area' });
  throwIf(error);
}

export type BodyMatch = { area: string; kind: 'on_me' | 'on_you'; intensity: number };

export async function loadBodyMatches(): Promise<BodyMatch[]> {
  const { data, error } = await api.rpc('body_map_matches');
  throwIf(error);
  return data ?? [];
}

// ─── fantasy box ────────────────────────────────────────────────────────────
export type Fantasy = FantasyListRow & { text: string | null };

export async function loadFantasies(sharedKey: Uint8Array | null): Promise<Fantasy[]> {
  const { data, error } = await api.rpc('list_fantasies');
  throwIf(error);
  return (data ?? []).map((f) => ({ ...f, text: tryOpenString(f.text_ciphertext, f.nonce, sharedKey) }));
}

export async function addFantasy(coupleId: string, category: string, heat: Heat, text: string, sharedKey: Uint8Array): Promise<void> {
  const s = sealString(text.trim(), sharedKey);
  const { error } = await api.from('fantasies').insert({ couple_id: coupleId, category, heat, text_ciphertext: s.c, nonce: s.n });
  throwIf(error);
}

export async function setFantasyInterest(id: string, interested: boolean): Promise<void> {
  const { error } = await api.rpc('fantasy_interest', { p_id: id, p_interested: interested });
  throwIf(error);
}

export async function deleteFantasy(id: string): Promise<void> {
  const { error } = await api.from('fantasies').delete().eq('id', id);
  throwIf(error);
}
