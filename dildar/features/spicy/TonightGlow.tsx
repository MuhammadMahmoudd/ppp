/**
 * Global, discreet "Tonight?" glow. Mount once above the app (inside the
 * session + lock gate). Shows when the partner sends a tonight signal that
 * isn't answered yet; one tap answers 👍 / "not tonight". The sender gets a
 * short glow back when their signal is answered.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Txt } from '@/components/Txt';
import { Pressy } from '@/components/Pressy';
import { HEAT_EMOJI } from '@/components/HeatBadge';
import { colors, radius, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/settings';
import { useSession } from '@/lib/session';
import { subscribeTable } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { decodeBody, type MessageMeta } from '@/lib/messages';
import type { Heat, MessageRow } from '@/lib/database.types';
import { answerTonight } from './tonight';

type Incoming = { id: string; heat: Heat; note?: string };
const MAX_AGE_MS = 12 * 3600_000;

function toIncoming(row: MessageRow, key: Uint8Array | null): Incoming | null {
  const b = decodeBody(row, key);
  if (!b || b.t !== 'tonight') return { id: row.id, heat: 2 };
  return { id: row.id, heat: b.heat, note: b.note };
}

export function TonightGlow() {
  const s = useStrings();
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { couple, userId, sharedKey, spicyActive } = useSession();
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [answerToast, setAnswerToast] = useState<'yes' | 'no' | null>(null);
  const [busy, setBusy] = useState(false);
  const glow = useSharedValue(0.5);
  const coupleId = couple?.id ?? null;

  // Latest unanswered signal from the partner (on mount / foreground).
  useEffect(() => {
    if (!coupleId || !userId || !spicyActive) return;
    supabase
      .from('messages')
      .select('*')
      .eq('type', 'tonight')
      .neq('sender_id', userId)
      .is('deleted_at', null)
      .gte('created_at', new Date(Date.now() - MAX_AGE_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const row = data?.[0];
        if (row && !(row.meta as MessageMeta).answer) setIncoming(toIncoming(row, sharedKey));
      });
  }, [coupleId, userId, spicyActive, sharedKey]);

  useEffect(() => {
    if (!coupleId || !userId) return;
    return subscribeTable<MessageRow>('messages', coupleId, (c) => {
      const row = c.new;
      if (!row || row.type !== 'tonight') return;
      const meta = (row.meta ?? {}) as MessageMeta;
      if (c.eventType === 'INSERT' && row.sender_id !== userId && !meta.answer) {
        setIncoming(toIncoming(row, sharedKey));
        haptic.soft();
        setTimeout(() => haptic.soft(), 260);
      }
      if (c.eventType === 'UPDATE' && meta.answer) {
        if (row.sender_id === userId) {
          setAnswerToast(meta.answer);
          haptic.success();
          setTimeout(() => setAnswerToast(null), 4500);
        } else {
          setIncoming((cur) => (cur?.id === row.id ? null : cur));
        }
      }
    });
  }, [coupleId, userId, sharedKey]);

  useEffect(() => {
    glow.value = incoming && !reduce ? withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0.45, { duration: 1400 })), -1) : 0.8;
  }, [incoming, reduce, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const answer = async (a: 'yes' | 'no') => {
    if (!incoming) return;
    setBusy(true);
    try {
      await answerTonight(incoming.id, a);
      if (a === 'yes') haptic.success();
      else haptic.tap();
      setIncoming(null);
    } catch {
      haptic.error();
    } finally {
      setBusy(false);
    }
  };

  if (!spicyActive || (!incoming && !answerToast)) return null;
  const top = insets.top + 64;

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.layer]}>
      {incoming ? (
        <Animated.View entering={FadeInUp.springify()} exiting={FadeOutUp} style={[styles.wrap, { top }]}>
          <Animated.View style={[styles.halo, glowStyle]} pointerEvents="none">
            <LinearGradient colors={['rgba(255,77,109,0.55)', 'rgba(201,24,74,0)']} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <View style={styles.card}>
            <View style={styles.row}>
              <Txt style={styles.emoji}>{HEAT_EMOJI[incoming.heat]}</Txt>
              <View style={styles.flex}>
                <Txt variant="heading">{s.spicy.tonightSheet.incoming}</Txt>
                {incoming.note ? <Txt variant="small" muted numberOfLines={2}>{incoming.note}</Txt> : null}
              </View>
              <Pressy onPress={() => setIncoming(null)} accessibilityLabel={s.spicy.tonightSheet.dismiss} hitSlop={10}>
                <Txt muted>✕</Txt>
              </Pressy>
            </View>
            <View style={styles.row}>
              <Pressy disabled={busy} onPress={() => answer('yes')} style={[styles.btn, styles.yes]} hapticStyle="none">
                <Txt variant="heading">{s.spicy.tonightSheet.yes}</Txt>
              </Pressy>
              <Pressy disabled={busy} onPress={() => answer('no')} style={[styles.btn, styles.no]} hapticStyle="none">
                <Txt variant="heading" color={colors.textMuted}>{s.spicy.tonightSheet.no}</Txt>
              </Pressy>
            </View>
          </View>
        </Animated.View>
      ) : answerToast ? (
        <Animated.View entering={FadeInUp.springify()} exiting={FadeOutUp} style={[styles.wrap, { top }]}>
          <View style={[styles.card, styles.toast]}>
            <Txt center variant="heading">{answerToast === 'yes' ? s.spicy.tonightSheet.answeredYes : s.spicy.tonightSheet.answeredNo}</Txt>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 900 },
  wrap: { position: 'absolute', start: space.lg, end: space.lg },
  halo: { position: 'absolute', top: -18, bottom: -18, start: -18, end: -18, borderRadius: radius.xl + 18, overflow: 'hidden' },
  card: { backgroundColor: 'rgba(30,8,14,0.96)', borderRadius: radius.xl, padding: space.lg, gap: space.md, borderWidth: 1, borderColor: 'rgba(255,77,109,0.5)' },
  toast: { paddingVertical: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  emoji: { fontSize: 32, lineHeight: 42 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.lg },
  yes: { backgroundColor: colors.accent },
  no: { backgroundColor: colors.surfaceStrong },
});
