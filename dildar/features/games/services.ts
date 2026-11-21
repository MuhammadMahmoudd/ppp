/**
 * Background services for games: warm the (encrypted) deck cache so game
 * rooms open instantly. The invite banner lives in GameInviteBanner.tsx.
 */
import { useEffect } from 'react';
import { useSession } from '@/lib/session';
import { reloadDecks } from '@/features/decks/useDecks';

export function useGamesServices(): void {
  const { sharedKey, userId } = useSession();
  useEffect(() => {
    if (sharedKey && userId) reloadDecks(sharedKey, userId);
  }, [sharedKey, userId]);
}
