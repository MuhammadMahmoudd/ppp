/**
 * For snap viewer, vault and spicy screens:
 *  • blocks screen *recording* (usePreventScreenCapture)
 *  • detects screenshots → logs a screenshot_event, drops a "📸" card in the
 *    chat, and pushes the partner.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { uuid } from '@/lib/ids';
import { sealJSON } from '@/lib/crypto';
import { notifyPartner } from '@/lib/push';
import type { ScreenshotContext } from '@/lib/database.types';

export async function reportScreenshot(coupleId: string, key: Uint8Array | null, context: ScreenshotContext, targetId?: string) {
  await api.from('screenshot_events').insert({ couple_id: coupleId, context, target_id: targetId ?? null });
  const body = key ? sealJSON({ context }, key) : null;
  await api.from('messages').insert({
    id: uuid(),
    couple_id: coupleId,
    type: 'screenshot',
    ciphertext: body?.c ?? null,
    nonce: body?.n ?? null,
    meta: { context, target_id: targetId ?? null },
  });
  notifyPartner('screenshot');
}

export function useScreenGuard(context: ScreenshotContext, targetId?: string, activeProp = true) {
  const { couple, sharedKey } = useSession();
  // Browsers can't block recording or detect screenshots.
  const active = activeProp && Platform.OS !== 'web';
  useEffect(() => {
    if (!active) return;
    const key = `guard-${context}`;
    ScreenCapture.preventScreenCaptureAsync(key).catch(() => undefined);
    return () => {
      ScreenCapture.allowScreenCaptureAsync(key).catch(() => undefined);
    };
  }, [active, context]);
  useEffect(() => {
    if (!active || !couple) return;
    const sub = ScreenCapture.addScreenshotListener(() => {
      reportScreenshot(couple.id, sharedKey, context, targetId).catch(() => undefined);
    });
    return () => sub.remove();
  }, [active, couple, sharedKey, context, targetId]);
}
