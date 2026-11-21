import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { subscribeTable } from '@/lib/realtime';
import type { SnapRow } from '@/lib/database.types';

/** Unopened snaps the partner sent me, oldest first (Snapchat order). */
export function useIncomingSnaps(coupleId: string | null, userId: string | null) {
  const [snaps, setSnaps] = useState<SnapRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!coupleId || !userId) return;
    const { data } = await supabase
      .from('snaps')
      .select('*')
      .eq('couple_id', coupleId)
      .neq('sender_id', userId)
      .is('opened_at', null)
      .gt('expires_at', new Date().toISOString())
      .not('storage_path', 'is', null)
      .order('created_at', { ascending: true })
      .limit(50);
    setSnaps(data ?? []);
    setLoading(false);
  }, [coupleId, userId]);

  useEffect(() => {
    load();
    if (!coupleId) return;
    return subscribeTable<SnapRow>('snaps', coupleId, () => load());
  }, [coupleId, load]);

  return { snaps, loading, reload: load };
}

/** Next unopened snap id after `currentId` (for "tap → next"). */
export async function nextUnopenedSnap(coupleId: string, userId: string, currentId: string): Promise<string | null> {
  const { data } = await supabase
    .from('snaps')
    .select('id')
    .eq('couple_id', coupleId)
    .neq('sender_id', userId)
    .neq('id', currentId)
    .is('opened_at', null)
    .gt('expires_at', new Date().toISOString())
    .not('storage_path', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1);
  return data?.[0]?.id ?? null;
}
