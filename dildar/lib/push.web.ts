/**
 * Web version of lib/push.ts. Browsers get no push notifications (no Expo
 * token), but they still *trigger* pushes to the partner's iPhone and keep
 * the preview preference in sync.
 */
import { api } from './api';

export type PushKind =
  | 'message' | 'snap' | 'game_invite' | 'touch' | 'miss_you' | 'tonight'
  | 'screenshot' | 'dare' | 'envelope' | 'daily_question' | 'vault' | 'reaction';

export async function registerForPush(_userId: string): Promise<string | null> {
  return null;
}

export async function setPushPreviews(userId: string, on: boolean): Promise<void> {
  await api.from('devices').upsert({ user_id: userId, push_previews: on });
}

/** Fire-and-forget: tells the partner's phone something happened. */
export function notifyPartner(kind: PushKind, data: Record<string, string> = {}): void {
  api.functions.invoke('send_push', { body: { kind, data } }).catch(() => undefined);
}

export function addPushResponseListener(_cb: (data: Record<string, unknown>) => void): () => void {
  return () => undefined;
}
