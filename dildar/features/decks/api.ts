/**
 * Decks & cards: names and card text are E2E-encrypted with the couple key.
 * RLS shows a deck/card only to its owner until it is shared.
 */
import { api } from '@/lib/api';
import { sealString, tryOpenString } from '@/lib/crypto';
import type { CardRow, DeckKind, DeckRow, Heat } from '@/lib/database.types';

export type DeckView = { id: string; kind: DeckKind; name: string; isShared: boolean; ownerId: string; mine: boolean; createdAt: string };
export type CardView = { id: string; deckId: string; kind: DeckKind; heat: Heat; category: string; text: string; isShared: boolean; ownerId: string; mine: boolean };

export async function fetchDecks(key: Uint8Array, me: string): Promise<{ decks: DeckView[]; cards: CardView[] }> {
  const [d, c] = await Promise.all([
    api.from('decks').select('*').order('created_at', { ascending: true }),
    api.from('cards').select('*').order('created_at', { ascending: true }),
  ]);
  if (d.error) throw d.error;
  if (c.error) throw c.error;
  const decks = (d.data ?? []).map((r: DeckRow): DeckView => ({
    id: r.id,
    kind: r.kind,
    name: tryOpenString(r.name_ciphertext, r.name_nonce, key) ?? '…',
    isShared: r.is_shared,
    ownerId: r.owner_id,
    mine: r.owner_id === me,
    createdAt: r.created_at,
  }));
  const kindOf = new Map(decks.map((x) => [x.id, x.kind]));
  const cards: CardView[] = [];
  for (const r of (c.data ?? []) as CardRow[]) {
    const text = tryOpenString(r.text_ciphertext, r.nonce, key);
    const kind = kindOf.get(r.deck_id);
    if (text == null || !kind) continue;
    cards.push({ id: r.id, deckId: r.deck_id, kind, heat: r.heat, category: r.category, text, isShared: r.is_shared, ownerId: r.owner_id, mine: r.owner_id === me });
  }
  return { decks, cards };
}

export async function createDeck(coupleId: string, kind: DeckKind, name: string, key: Uint8Array): Promise<string> {
  const s = sealString(name.trim(), key);
  const { data, error } = await api
    .from('decks')
    .insert({ couple_id: coupleId, kind, name_ciphertext: s.c, name_nonce: s.n })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('insert_failed');
  return data.id;
}

export async function renameDeck(id: string, name: string, key: Uint8Array): Promise<void> {
  const s = sealString(name.trim(), key);
  const { error } = await api.from('decks').update({ name_ciphertext: s.c, name_nonce: s.n }).eq('id', id);
  if (error) throw error;
}

export async function setDeckShared(id: string, shared: boolean): Promise<void> {
  const { error } = await api.rpc('set_deck_shared', { p_deck: id, p_shared: shared });
  if (error) throw error;
}

export async function deleteDeck(id: string): Promise<void> {
  const { error } = await api.from('decks').delete().eq('id', id);
  if (error) throw error;
}

export async function addCards(
  deckId: string,
  coupleId: string,
  cards: { text: string; heat: Heat; category?: string }[],
  key: Uint8Array,
): Promise<number> {
  if (!cards.length) return 0;
  const rows = cards.map((c) => {
    const s = sealString(c.text, key);
    return { deck_id: deckId, couple_id: coupleId, heat: c.heat, category: (c.category || 'general').slice(0, 40), text_ciphertext: s.c, nonce: s.n };
  });
  // chunk to keep requests small
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await api.from('cards').insert(rows.slice(i, i + 100));
    if (error) throw error;
  }
  return rows.length;
}

export async function updateCard(id: string, patch: { text?: string; heat?: Heat; category?: string }, key: Uint8Array): Promise<void> {
  const upd: Partial<CardRow> = {};
  if (patch.text != null) {
    const s = sealString(patch.text, key);
    upd.text_ciphertext = s.c;
    upd.nonce = s.n;
  }
  if (patch.heat != null) upd.heat = patch.heat;
  if (patch.category != null) upd.category = patch.category.slice(0, 40);
  const { error } = await api.from('cards').update(upd).eq('id', id);
  if (error) throw error;
}

export async function deleteCard(id: string): Promise<void> {
  const { error } = await api.from('cards').delete().eq('id', id);
  if (error) throw error;
}
