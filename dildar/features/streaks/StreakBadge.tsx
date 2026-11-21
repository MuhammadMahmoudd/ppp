import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Pressy } from '@/components/Pressy';
import { Txt } from '@/components/Txt';
import { colors, radius } from '@/lib/theme';
import { useSession } from '@/lib/session';
import { freezesAvailable, streakStatus } from '@/lib/streak';
import { num } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/settings';

/** 🔥 counter for camera/chat headers. ⏳ pulses when at risk. */
export function StreakBadge({ onPress }: { onPress?: () => void }) {
  const { couple } = useSession();
  const reduce = useReducedMotion();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const pulse = useSharedValue(1);
  const st = couple
    ? streakStatus(couple.streak_count, couple.streak_last_day, couple.home_timezone, now,
        freezesAvailable(couple.streak_freezes_left, couple.streak_freeze_month, couple.home_timezone, now))
    : null;
  const atRisk = st?.state === 'pending_today' && st.atRisk;
  useEffect(() => {
    pulse.value = atRisk && !reduce ? withRepeat(withSequence(withTiming(1.12, { duration: 500 }), withTiming(1, { duration: 500 })), -1) : 1;
  }, [atRisk, reduce, pulse]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  if (!st) return null;
  const count = st.count;
  const icon = st.state === 'freezable' ? '❄️' : atRisk ? '⏳' : st.state === 'done_today' ? '🔥' : count > 0 ? '🔥' : '🤍';
  return (
    <Pressy onPress={onPress} accessibilityLabel={`streak ${count}`}>
      <Animated.View style={[styles.pill, st.state === 'done_today' && styles.done, a]}>
        <Txt variant="tiny">{icon}</Txt>
        <Txt variant="heading" style={styles.count}>{num(count)}</Txt>
      </Animated.View>
    </Pressy>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 34, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  done: { borderColor: 'rgba(255,107,61,0.6)' },
  count: { fontSize: 15, lineHeight: 22 },
});

export const StreakSpacer = () => <View style={{ width: 8 }} />;
