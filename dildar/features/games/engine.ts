/**
 * Live game room sync.
 *
 *   actor: next = mutator(state) → local (optimistic) → broadcast (E2E) →
 *          rpc game_apply(expected_version) → on version_conflict: refetch,
 *          replay the mutator on the fresh state, retry.
 *   other phone: broadcast (fast) + postgres_changes (authoritative).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase, errorCode } from '@/lib/supabase';
import { sealJSON, tryOpenJSON } from '@/lib/crypto';
import { broadcastSealed, onBroadcast, openSealed, presenceStore, setPresenceScreen, subscribeTable, usePresence } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import type { GameSessionRow, GameStatus } from '@/lib/database.types';
import type { GameState } from './logic';
import { conflictDelay, MAX_APPLY_ATTEMPTS, merge, type Snapshot, type Source } from './engineCore';

type Wire = { state: GameState; status: GameStatus };

export type Room = {
  loading: boolean;
  error: string | null;
  row: GameSessionRow | null;
  state: GameState | null;
  status: GameStatus;
  version: number;
  syncing: boolean;
  partnerHere: boolean;
  apply: (mutator: (s: GameState) => GameState, opts?: { status?: GameStatus }) => Promise<boolean>;
  reload: () => Promise<void>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function decodeRow(row: GameSessionRow, key: Uint8Array | null): GameState | null {
  const w = tryOpenJSON<Wire | GameState>(row.state_ciphertext, row.state_nonce, key);
  if (!w) return null;
  return 'state' in w ? w.state : w;
}

export function sealWire(state: GameState, status: GameStatus, key: Uint8Array) {
  return sealJSON({ state, status } satisfies Wire, key);
}

export function useGameRoom(id: string): Room {
  const { couple, sharedKey } = useSession();
  const coupleId = couple?.id ?? null;
  const presence = usePresence();
  const [snap, setSnap] = useState<Snapshot<GameState>>({ version: -1, state: null, status: 'invited' });
  const [row, setRow] = useState<GameSessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const ref = useRef(snap);
  const keyRef = useRef(sharedKey);
  keyRef.current = sharedKey;

  const accept = useCallback((incoming: Snapshot<GameState>, source: Source) => {
    const next = merge(ref.current, incoming, source);
    if (next !== ref.current) {
      ref.current = next;
      setSnap(next);
    }
  }, []);

  const fromRow = useCallback(
    (r: GameSessionRow) => {
      setRow(r);
      const st = decodeRow(r, keyRef.current);
      if (st) accept({ version: r.version, state: st, status: r.status }, 'db');
    },
    [accept],
  );

  const reload = useCallback(async () => {
    const { data, error: e } = await supabase.from('game_sessions').select('*').eq('id', id).maybeSingle();
    if (e) setError(errorCode(e));
    else if (!data) setError('not_found');
    else {
      setError(null);
      fromRow(data);
    }
    setLoading(false);
  }, [id, fromRow]);

  // initial load + realtime + reconnect
  useEffect(() => {
    reload();
    const offB = onBroadcast('game:state', (p) => {
      if (p.id !== id) return;
      const w = openSealed<Wire>(p, keyRef.current);
      if (w && typeof p.version === 'number') accept({ version: p.version, state: w.state, status: w.status }, 'broadcast');
    });
    const offDb = coupleId
      ? subscribeTable<GameSessionRow>('game_sessions', coupleId, (c) => {
          if (c.new && (c.new as GameSessionRow).id === id) fromRow(c.new as GameSessionRow);
        })
      : () => undefined;
    const offApp = AppState.addEventListener('change', (st) => st === 'active' && reload());
    let wasConnected = presenceStore.get().connected;
    const offPresence = presenceStore.subscribe(() => {
      const c = presenceStore.get().connected;
      if (c && !wasConnected) reload();
      wasConnected = c;
    });
    setPresenceScreen(`game:${id}`);
    return () => {
      offB();
      offDb();
      offApp.remove();
      offPresence();
      setPresenceScreen('games');
    };
  }, [id, coupleId, reload, accept, fromRow]);

  const apply = useCallback(
    async (mutator: (s: GameState) => GameState, opts: { status?: GameStatus } = {}) => {
      const key = keyRef.current;
      if (!key) return false;
      setSyncing(true);
      try {
        for (let attempt = 0; attempt < MAX_APPLY_ATTEMPTS; attempt++) {
          const cur = ref.current;
          if (!cur.state) {
            await reload();
            continue;
          }
          const next = mutator(cur.state);
          const status = opts.status ?? cur.status;
          const optimistic = { version: cur.version + 1, state: next, status };
          accept(optimistic, 'local');
          broadcastSealed('game:state', { state: next, status } satisfies Wire, key, { id, version: optimistic.version });
          const sealed = sealWire(next, status, key);
          const { data, error: e } = await supabase.rpc('game_apply', {
            p_id: id,
            p_expected_version: cur.version,
            p_state_ciphertext: sealed.c,
            p_state_nonce: sealed.n,
            p_status: status,
          });
          if (!e && data) {
            setRow(data);
            accept({ version: data.version, state: next, status: data.status }, 'db');
            return true;
          }
          if (errorCode(e) !== 'version_conflict') {
            setError(errorCode(e));
            return false;
          }
          // someone else wrote first: take the server truth and replay
          ref.current = { ...ref.current, version: -1 };
          await reload();
          await sleep(conflictDelay(attempt));
        }
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [id, accept, reload],
  );

  return {
    loading,
    error,
    row,
    state: snap.state,
    status: snap.status,
    version: snap.version,
    syncing,
    partnerHere: presence.partnerOnline && presence.partnerScreen === `game:${id}`,
    apply,
    reload,
  };
}
