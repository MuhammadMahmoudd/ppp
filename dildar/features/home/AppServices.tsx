/** Long-lived services that run while paired + unlocked. */
import { useEffect } from 'react';
import { router } from 'expo-router';
import { useSession } from '@/lib/session';
import { addPushResponseListener, registerForPush } from '@/lib/push';
import { useChatServices } from '@/features/chat/services';
import { useSnapsServices } from '@/features/snaps/services';
import { useGamesServices } from '@/features/games/services';
import { useSpicyServices } from '@/features/spicy/services';
import { useVaultServices } from '@/features/vault/services';
import { useClosenessServices } from '@/features/closeness/services';

export function AppServices() {
  const { userId } = useSession();
  useEffect(() => {
    if (userId) registerForPush(userId).catch(() => undefined);
  }, [userId]);
  useEffect(
    () =>
      addPushResponseListener((data) => {
        const route = typeof data.route === 'string' ? data.route : null;
        if (route && route.startsWith('/')) router.push(route as never);
      }),
    [],
  );
  useChatServices();
  useSnapsServices();
  useGamesServices();
  useSpicyServices();
  useVaultServices();
  useClosenessServices();
  return null;
}
