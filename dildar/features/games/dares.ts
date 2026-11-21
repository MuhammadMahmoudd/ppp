/** Async dares: posted into the chat with a deadline; proof by snap or voice. */
import { postMessage, decodeBody, type MessageBody } from '@/lib/messages';
import { supabase } from '@/lib/supabase';
import type { Heat, MessageRow } from '@/lib/database.types';

export type DareProof = 'snap' | 'voice' | null;
export type DareView = {
  id: string;
  fromMe: boolean;
  text: string;
  heat: Heat;
  proof: DareProof;
  deadline: string;
  doneAt: string | null;
  createdAt: string;
};

export async function sendDare(o: {
  coupleId: string;
  me: string;
  key: Uint8Array;
  text: string;
  heat: Heat;
  proof: DareProof;
  deadlineMs: number;
}): Promise<string> {
  const deadline = new Date(Date.now() + o.deadlineMs).toISOString();
  return postMessage({
    coupleId: o.coupleId,
    senderId: o.me,
    key: o.key,
    type: 'dare',
    body: { t: 'dare', text: o.text.trim(), heat: o.heat, proof: o.proof, deadline },
    meta: { deadline },
  });
}

export async function fetchDares(key: Uint8Array, me: string): Promise<DareView[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('type', 'dare')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  const out: DareView[] = [];
  for (const r of (data ?? []) as MessageRow[]) {
    const b = decodeBody(r, key) as Extract<MessageBody, { t: 'dare' }> | null;
    if (!b || b.t !== 'dare') continue;
    const meta = r.meta as { deadline?: string; done_at?: string };
    out.push({
      id: r.id,
      fromMe: r.sender_id === me,
      text: b.text,
      heat: b.heat,
      proof: b.proof,
      deadline: meta.deadline ?? b.deadline,
      doneAt: meta.done_at ?? null,
      createdAt: r.created_at,
    });
  }
  return out;
}

export function isOpen(d: DareView, now = Date.now()): boolean {
  return !d.doneAt && new Date(d.deadline).getTime() > now;
}

export async function completeDare(messageId: string, proofMessageId?: string): Promise<void> {
  const { error } = await supabase.rpc('complete_dare', proofMessageId ? { message_id: messageId, proof_message_id: proofMessageId } : { message_id: messageId });
  if (error) throw error;
}
