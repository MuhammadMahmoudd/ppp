import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { subscribeTable } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import type { GameSessionRow } from '@/lib/database.types';

export type SessionLite = Pick<GameSessionRow, 'id' | 'game_type' | 'status' | 'created_by' | 'created_at' | 'updated_at'>;

/** Recent game sessions, kept live. */
export function useGameSessions() {
  const { couple } = useSession();
  const coupleId = couple?.id ?? null;
  const [items, setItems] = useState<SessionLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('game_sessions')
      .select('id, game_type, status, created_by, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20);
    setError(!!e);
    if (data) setItems(data);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    if (!coupleId) return;
    return subscribeTable<GameSessionRow>('game_sessions', coupleId, () => load());
  }, [coupleId, load]);
  return { items, loading, error, reload: load };
}
