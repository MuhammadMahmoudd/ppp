import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSession } from '@/lib/session';
import { createStore, useStore } from '@/lib/store';
import { fetchDecks, type CardView, type DeckView } from './api';

type DecksState = { decks: DeckView[]; cards: CardView[]; loaded: boolean; error: boolean };
/** Shared cache so the deck manager and game rooms see the same data. */
export const decksStore = createStore<DecksState>({ decks: [], cards: [], loaded: false, error: false });

let inflight: Promise<void> | null = null;
export function reloadDecks(key: Uint8Array, me: string): Promise<void> {
  if (inflight) return inflight;
  inflight = fetchDecks(key, me)
    .then(({ decks, cards }) => decksStore.set({ decks, cards, loaded: true, error: false }))
    .catch(() => decksStore.set((s) => ({ ...s, loaded: true, error: true })))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useDecks(opts: { refreshOnFocus?: boolean } = {}) {
  const { sharedKey, userId } = useSession();
  const state = useStore(decksStore);
  const reload = useCallback(async () => {
    if (sharedKey && userId) await reloadDecks(sharedKey, userId);
  }, [sharedKey, userId]);
  useEffect(() => {
    if (!state.loaded) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);
  useFocusEffect(
    useCallback(() => {
      if (opts.refreshOnFocus) reload();
    }, [opts.refreshOnFocus, reload]),
  );
  return { ...state, reload };
}
