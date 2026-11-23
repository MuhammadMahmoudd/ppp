import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { subscribeTable } from '@/lib/realtime';
import { tryOpenJSON, tryOpenString } from '@/lib/crypto';
import type { VaultAlbumRow, VaultDeleteRequestRow, VaultItemRow } from '@/lib/database.types';

export type VaultMeta = { mime?: string; ext?: string; w?: number; h?: number; duration?: number; from?: string };
export type VaultItem = VaultItemRow & { meta: VaultMeta };
export type VaultAlbum = VaultAlbumRow & { name: string };

export function useVault(coupleId: string | null, key: Uint8Array | null) {
  const [items, setItems] = useState<VaultItem[] | null>(null);
  const [albums, setAlbums] = useState<VaultAlbum[]>([]);
  const [requests, setRequests] = useState<VaultDeleteRequestRow[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!coupleId) return;
    setError(false);
    const [it, al, rq] = await Promise.all([
      api.from('vault_items').select('*').eq('couple_id', coupleId).order('created_at', { ascending: false }).limit(500),
      api.from('vault_albums').select('*').eq('couple_id', coupleId).order('created_at'),
      api.from('vault_delete_requests').select('*').eq('couple_id', coupleId),
    ]);
    if (it.error) {
      setError(true);
      return;
    }
    setItems((it.data ?? []).map((r) => ({ ...r, meta: tryOpenJSON<VaultMeta>(r.meta_ciphertext, r.meta_nonce, key) ?? {} })));
    setAlbums((al.data ?? []).map((a) => ({ ...a, name: tryOpenString(a.name_ciphertext, a.name_nonce, key) ?? '🔒' })));
    setRequests(rq.data ?? []);
  }, [coupleId, key]);

  useEffect(() => {
    load();
    if (!coupleId) return;
    return subscribeTable<VaultItemRow>('vault_items', coupleId, () => load());
  }, [coupleId, load]);

  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  return { items, albums, requests, error, reload: load, byId };
}

export async function fetchVaultItem(id: string, key: Uint8Array | null): Promise<VaultItem | null> {
  const { data } = await api.from('vault_items').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  return { ...data, meta: tryOpenJSON<VaultMeta>(data.meta_ciphertext, data.meta_nonce, key) ?? {} };
}
