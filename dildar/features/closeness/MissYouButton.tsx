/** One-tap "بیرت دەکەم" — buzz + animation on their side, daily counter here. */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Txt } from '@/components/Txt';
import { Pressy } from '@/components/Pressy';
import { colors, gradients, radius, space, springs } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/lib/session';
import { useOnline } from '@/lib/offlineQueue';
import { useReducedMotion } from '@/lib/settings';
import { sendMissYou, useMissYouToday } from './hooks';
import { HeartsBurst } from './ui';

export function MissYouButton() {
  const s = useStrings();
  const { couple } = useSession();
  const online = useOnline();
  const reduce = useReducedMotion();
  const { mine, theirs } = useMissYouToday();
  const [bursts, setBursts] = useState<number[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const sc = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));

  const press = async () => {
    if (!couple) return;
    haptic.send();
    sc.value = reduce ? 1 : withSequence(withSpring(0.9, springs.snappy), withSpring(1.06, springs.bouncy), withTiming(1, { duration: 200 }));
    setBursts((b) => [...b.slice(-2), Date.now()]);
    const ok = await sendMissYou(couple.id);
    setStatus(ok ? s.closeness.miss.sent : online ? s.states.errorBody : s.states.offline);
    if (!ok) haptic.error();
    setTimeout(() => setStatus(null), 2000);
  };

  return (
    <View style={styles.wrap}>
      <Pressy onPress={press} hapticStyle="none" accessibilityLabel={s.closeness.miss.button} scaleTo={1}>
        <Animated.View style={a}>
          <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
            <Txt style={styles.emoji}>💗</Txt>
            <Txt variant="title">{s.closeness.miss.button}</Txt>
          </LinearGradient>
        </Animated.View>
      </Pressy>
      <View style={styles.counts}>
        <Txt variant="small" muted>{fmt(s.closeness.miss.mine, { n: mine })}</Txt>
        <Txt variant="small" color={colors.rose}>{fmt(s.closeness.miss.theirs, { n: theirs })}</Txt>
      </View>
      {status ? <Txt variant="small" center muted>{status}</Txt> : null}
      {bursts.map((b) => <HeartsBurst key={b} onDone={() => setBursts((x) => x.filter((y) => y !== b))} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  btn: { borderRadius: radius.xl, paddingVertical: space.xl, alignItems: 'center', gap: 4 },
  emoji: { fontSize: 40, lineHeight: 52 },
  counts: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xs },
});
