/**
 * Mounted once, globally (above the pager). Plays what the partner sends live:
 *  • touch taps → matching haptic pattern + ripple at the same relative spot
 *  • miss-you buzzes → floating hearts + soft haptic
 * Sources: realtime broadcast (instant, when both apps are open), plus
 * table inserts as a fallback when presence lagged and the sender posted a
 * 'touch' message / miss_you_events row instead.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Txt } from '@/components/Txt';
import { Glass } from '@/components/Glass';
import { colors, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { onBroadcast, subscribeTable } from '@/lib/realtime';
import { playPattern, type TouchPattern } from '@/lib/haptics';
import { useSession } from '@/lib/session';
import { decodeBody } from '@/lib/messages';
import type { MessageRow, MissYouRow } from '@/lib/database.types';
import { HeartsBurst, Ripple, type RippleSpec } from './ui';

const PATTERNS: TouchPattern[] = ['heartbeat', 'slow', 'tease', 'long', 'tap'];
const asPattern = (p: unknown): TouchPattern => (PATTERNS.includes(p as TouchPattern) ? (p as TouchPattern) : 'tap');
const clamp01 = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);

export function IncomingOverlay() {
  const s = useStrings();
  const { width, height } = useWindowDimensions();
  const { couple, userId, partner, sharedKey } = useSession();
  const [ripples, setRipples] = useState<RippleSpec[]>([]);
  const [bursts, setBursts] = useState<number[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const seq = useRef(1);
  const lastLiveMiss = useRef(0);
  const lastLiveTouch = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const name = partner?.display_name ?? s.common.partner;

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const touch = useCallback(
    (pattern: TouchPattern, x: number, y: number) => {
      const id = seq.current++;
      setRipples((r) => [...r.slice(-6), { id, x: x * width, y: y * height }]);
      playPattern(pattern);
    },
    [width, height],
  );

  const missYou = useCallback(() => {
    setBursts((b) => [...b.slice(-2), seq.current++]);
    showToast(fmt(s.closeness.miss.received, { name }));
  }, [showToast, s, name]);

  useEffect(() => {
    const offTouch = onBroadcast('touch', (p) => {
      lastLiveTouch.current = Date.now();
      touch(asPattern(p.pattern), clamp01(p.x, 0.5), clamp01(p.y, 0.5));
    });
    const offMiss = onBroadcast('miss_you', () => {
      lastLiveMiss.current = Date.now();
      missYou();
    });
    return () => {
      offTouch();
      offMiss();
    };
  }, [touch, missYou]);

  const coupleId = couple?.id;
  useEffect(() => {
    if (!coupleId || !userId) return;
    const offMiss = subscribeTable<MissYouRow>('miss_you_events', coupleId, (c) => {
      if (c.eventType !== 'INSERT' || c.new.sender_id === userId) return;
      if (Date.now() - lastLiveMiss.current < 5000) return; // already shown via broadcast
      missYou();
    });
    const offMsg = subscribeTable<MessageRow>('messages', coupleId, (c) => {
      if (c.eventType !== 'INSERT' || c.new.type !== 'touch' || c.new.sender_id === userId) return;
      if (Date.now() - lastLiveTouch.current < 5000) return;
      const body = decodeBody(c.new, sharedKey);
      touch(body?.t === 'touch' ? asPattern(body.pattern) : 'heartbeat', 0.5, 0.45);
      showToast(fmt(s.closeness.touch.incoming, { name }));
    });
    return () => {
      offMiss();
      offMsg();
    };
  }, [coupleId, userId, sharedKey, missYou, touch, showToast, s, name]);

  const removeRipple = useCallback((id: number) => setRipples((r) => r.filter((x) => x.id !== id)), []);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root]}>
      <View style={styles.ltrLayer}>
        {ripples.map((r) => <Ripple key={r.id} spec={r} onDone={removeRipple} size={260} />)}
      </View>
      {bursts.map((b) => <HeartsBurst key={b} onDone={() => setBursts((x) => x.filter((y) => y !== b))} />)}
      {toast ? (
        <Animated.View entering={FadeInUp.springify()} exiting={FadeOutUp} style={styles.toastWrap}>
          <Glass style={styles.toast}><Txt center color={colors.text}>{toast}</Txt></Glass>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 900 },
  ltrLayer: { ...StyleSheet.absoluteFillObject, direction: 'ltr' },
  toastWrap: { position: 'absolute', top: 64, start: space.xl, end: space.xl },
  toast: { paddingVertical: space.md },
});
