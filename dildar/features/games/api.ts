import { supabase } from '@/lib/supabase';
import { broadcast } from '@/lib/realtime';
import { notifyPartner } from '@/lib/push';
import type { GameType, Heat, MemberRow } from '@/lib/database.types';
import type { DieDef } from '@/features/decks/pools';
import { initialState, type Players } from './logic';
import { sealWire } from './engine';

export function playersOf(members: MemberRow[]): Players | null {
  const a = members.find((m) => m.role === 'a')?.user_id;
  const b = members.find((m) => m.role === 'b')?.user_id;
  return a && b ? { a, b } : null;
}

/** Creates an invited session, pings the partner (in-app + push) and returns its id. */
export async function startGame(o: {
  game: GameType;
  coupleId: string;
  me: string;
  members: MemberRow[];
  key: Uint8Array;
  heat?: Heat;
  dice?: DieDef[];
}): Promise<string> {
  const players = playersOf(o.members);
  if (!players) throw new Error('not_paired');
  const state = initialState(o.game, players, o.me, { heat: o.heat, dice: o.dice });
  const sealed = sealWire(state, 'invited', o.key);
  const { data, error } = await supabase
    .from('game_sessions')
    .insert({ couple_id: o.coupleId, game_type: o.game, state_ciphertext: sealed.c, state_nonce: sealed.n, turn_user_id: o.me })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('insert_failed');
  broadcast('game:invite', { id: data.id, game: o.game });
  notifyPartner('game_invite', { route: `/games/${data.id}` });
  return data.id;
}

export async function cancelGame(id: string, version: number, key: Uint8Array, state: unknown): Promise<void> {
  const s = sealWire(state as never, 'cancelled', key);
  await supabase.rpc('game_apply', { p_id: id, p_expected_version: version, p_state_ciphertext: s.c, p_state_nonce: s.n, p_status: 'cancelled' });
}
