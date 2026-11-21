/** Small UI pieces shared by the closeness screens. */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Txt } from '@/components/Txt';
import { Input } from '@/components/Input';
import { Pressy } from '@/components/Pressy';
import { colors, gradients, radius, space, springs } from '@/lib/theme';
import { num, useStrings } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/settings';
import { haptic } from '@/lib/haptics';
import { countdownParts } from './logic';

export type RippleSpec = { id: number; x: number; y: number; color?: string };

/** Expanding ring at (x, y), removes itself when done. */
export function Ripple({ spec, onDone, size = 220 }: { spec: RippleSpec; onDone: (id: number) => void; size?: number }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: reduce ? 450 : 1100, easing: Easing.out(Easing.cubic) });
    const id = setTimeout(() => onDone(spec.id), reduce ? 500 : 1150);
    return () => clearTimeout(id);
  }, [t, reduce, onDone, spec.id]);
  const a = useAnimatedStyle(() => ({
    opacity: 0.85 * (1 - t.value),
    transform: [{ scale: reduce ? 0.6 : 0.15 + t.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        { width: size, height: size, borderRadius: size / 2, left: spec.x - size / 2, top: spec.y - size / 2, borderColor: spec.color ?? colors.rose },
        a,
      ]}
    />
  );
}

/** Big d/h/m/s digits. */
export function CountdownDigits({ targetIso, now, compact }: { targetIso: string; now: number; compact?: boolean }) {
  const s = useStrings();
  const p = countdownParts(targetIso, now);
  const cells: [number, string][] = [[p.d, s.closeness.countdown.d], [p.h, s.closeness.countdown.h], [p.m, s.closeness.countdown.m], [p.s, s.closeness.countdown.s]];
  return (
    <View style={styles.digits}>
      {cells.map(([v, label], i) => (
        <View key={i} style={[styles.cell, compact && styles.cellCompact]}>
          <Txt variant={compact ? 'heading' : 'title'} center style={styles.mono}>{num(String(v).padStart(2, '0'))}</Txt>
          <Txt variant="tiny" muted center>{label}</Txt>
        </View>
      ))}
    </View>
  );
}

/** A soft beating heart; `beat` increments trigger one pulse. */
export function BeatingHeart({ beat, size = 140, together }: { beat: number; size?: number; together?: boolean }) {
  const reduce = useReducedMotion();
  const sc = useSharedValue(1);
  useEffect(() => {
    if (beat === 0) return;
    sc.value = reduce
      ? withSequence(withTiming(1.03, { duration: 120 }), withTiming(1, { duration: 300 }))
      : withSequence(withSpring(1.14, springs.snappy), withTiming(1.02, { duration: 130 }), withSpring(1.1, springs.snappy), withTiming(1, { duration: 500 }));
  }, [beat, reduce, sc]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Animated.View style={a}>
      <LinearGradient colors={together ? gradients.accent : (['#3A1622', '#1A0F14'] as const)} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
        <Txt style={{ fontSize: size * 0.42, lineHeight: size * 0.56 }}>{together ? '💞' : '🤍'}</Txt>
      </LinearGradient>
    </Animated.View>
  );
}

/** Date + time inputs (YYYY-MM-DD, HH:MM). */
export function DateTimeFields({ date, time, onDate, onTime, error }: { date: string; time: string; onDate: (v: string) => void; onTime: (v: string) => void; error?: string | null }) {
  const s = useStrings();
  return (
    <View style={styles.dtRow}>
      <View style={styles.flex2}>
        <Input label={s.closeness.datetime.date} value={date} onChangeText={onDate} placeholder={s.closeness.datetime.datePh} keyboardType="numbers-and-punctuation" autoCorrect={false} style={styles.ltr} />
      </View>
      <View style={styles.flex1}>
        <Input label={s.closeness.datetime.time} value={time} onChangeText={onTime} placeholder={s.closeness.datetime.timePh} keyboardType="numbers-and-punctuation" autoCorrect={false} style={styles.ltr} />
      </View>
      {error ? <Txt variant="small" color={colors.danger} style={styles.full}>{error}</Txt> : null}
    </View>
  );
}

/** Tappable tile for the hub grid. */
export function Tile({ emoji, title, subtitle, onPress, wide }: { emoji: string; title: string; subtitle?: string; onPress: () => void; wide?: boolean }) {
  return (
    <Pressy onPress={onPress} style={[styles.tile, wide && styles.tileWide]} scaleTo={0.97}>
      <Txt style={styles.tileEmoji}>{emoji}</Txt>
      <Txt variant="heading" numberOfLines={1}>{title}</Txt>
      {subtitle ? <Txt variant="small" muted numberOfLines={2}>{subtitle}</Txt> : null}
    </Pressy>
  );
}

/** Floating hearts burst (incoming miss-you). */
export function HeartsBurst({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  const [items] = useState(() => Array.from({ length: reduce ? 3 : 12 }, (_, i) => ({ i, dx: (Math.random() - 0.5) * 220, delay: i * 70, size: 18 + Math.random() * 22 })));
  useEffect(() => {
    haptic.soft();
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((h) => <FloatingHeart key={h.i} dx={h.dx} delay={h.delay} size={h.size} reduce={reduce} />)}
    </View>
  );
}

function FloatingHeart({ dx, delay, size, reduce }: { dx: number; delay: number; size: number; reduce: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    const id = setTimeout(() => { t.value = withTiming(1, { duration: reduce ? 900 : 1900, easing: Easing.out(Easing.quad) }); }, delay);
    return () => clearTimeout(id);
  }, [t, delay, reduce]);
  const a = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 1 - t.value,
    transform: [{ translateX: reduce ? 0 : dx * t.value }, { translateY: -(reduce ? 80 : 420) * t.value }, { scale: 0.6 + t.value * 0.6 }],
  }));
  return <Animated.Text style={[styles.heart, { fontSize: size }, a]}>💗</Animated.Text>;
}

const styles = StyleSheet.create({
  ripple: { position: 'absolute', borderWidth: 3 },
  digits: { flexDirection: 'row', gap: space.sm, justifyContent: 'center', direction: 'ltr' },
  cell: { minWidth: 64, paddingVertical: space.sm, paddingHorizontal: space.xs, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cellCompact: { minWidth: 52, paddingVertical: 4 },
  mono: { fontVariant: ['tabular-nums'] },
  dtRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  flex2: { flex: 2, minWidth: 150 },
  flex1: { flex: 1, minWidth: 90 },
  full: { width: '100%' },
  ltr: { writingDirection: 'ltr' },
  tile: { flexBasis: '47%', flexGrow: 1, minHeight: 120, padding: space.lg, gap: 4, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tileWide: { flexBasis: '100%' },
  tileEmoji: { fontSize: 30, lineHeight: 40 },
  heart: { position: 'absolute', bottom: 80, alignSelf: 'center' },
});
