/**
 * Background services for chat: kick the offline queue whenever the
 * realtime channel (re)connects, so queued messages go out immediately.
 */
import { useEffect } from 'react';
import { flush } from '@/lib/offlineQueue';
import { presenceStore } from '@/lib/realtime';

export function useChatServices(): void {
  useEffect(() => {
    let wasConnected = presenceStore.get().connected;
    const unsubscribe = presenceStore.subscribe(() => {
      const c = presenceStore.get().connected;
      if (c && !wasConnected) flush();
      wasConnected = c;
    });
    return () => {
      unsubscribe();
    };
  }, []);
}
