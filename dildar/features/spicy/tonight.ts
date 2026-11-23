import { api } from '@/lib/api';
import { postMessage } from '@/lib/messages';
import { notifyPartner } from '@/lib/push';
import type { Heat } from '@/lib/database.types';

export async function sendTonight(o: { coupleId: string; senderId: string; key: Uint8Array; heat: Heat; note?: string }): Promise<string> {
  const note = o.note?.trim() || undefined;
  return postMessage({ coupleId: o.coupleId, senderId: o.senderId, key: o.key, type: 'tonight', body: { t: 'tonight', heat: o.heat, note } });
}

export async function answerTonight(messageId: string, answer: 'yes' | 'no'): Promise<void> {
  const { error } = await api.rpc('answer_signal', { message_id: messageId, answer });
  if (error) throw error;
  notifyPartner('tonight');
}
