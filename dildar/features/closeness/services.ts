/**
 * Background services for the closeness feature. Called once from
 * features/home/AppServices.tsx while the app is in the 'ready' stage.
 * Incoming touches / miss-you buzzes are handled by <IncomingOverlay/>,
 * which must be mounted globally (it needs to render).
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSession } from '@/lib/session';
import { loadCountdown } from './hooks';

export function useClosenessServices(): void {
  const { sharedKey } = useSession();
  // Warm the countdown so the Chat tab header renders instantly, and refresh
  // it whenever the app comes back to the foreground.
  useEffect(() => {
    if (!sharedKey) return;
    loadCountdown(sharedKey).catch(() => undefined);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') loadCountdown(sharedKey).catch(() => undefined);
    });
    return () => sub.remove();
  }, [sharedKey]);
}
