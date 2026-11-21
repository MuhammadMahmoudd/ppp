/**
 * Push: discreet by default ("دڵدار — شتێکی نوێ"). The server never sees
 * message content (E2E), so previews can only reveal the *type* of thing.
 */
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export type PushKind =
  | 'message' | 'snap' | 'game_invite' | 'touch' | 'miss_you' | 'tonight'
  | 'screenshot' | 'dare' | 'envelope' | 'daily_question' | 'vault' | 'reaction';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // In the foreground the app shows its own in-app UI instead.
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerForPush(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null;
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Dildar', importance: Notifications.AndroidImportance.HIGH });
  }
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return null;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await supabase.from('devices').upsert({ user_id: userId, push_token: token });
  return token;
}

export async function setPushPreviews(userId: string, on: boolean): Promise<void> {
  await supabase.from('devices').upsert({ user_id: userId, push_previews: on });
}

/** Fire-and-forget: tells the partner's phone something happened. */
export function notifyPartner(kind: PushKind, data: Record<string, string> = {}): void {
  supabase.functions.invoke('send_push', { body: { kind, data } }).catch(() => undefined);
}

export function addPushResponseListener(cb: (data: Record<string, unknown>) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => cb(r.notification.request.content.data ?? {}));
  return () => sub.remove();
}
