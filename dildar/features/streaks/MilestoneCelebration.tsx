/** Full-screen burst + success haptics when the streak hits 7/30/50/100/200/365. */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { Txt } from '@/components/Txt';
import { colors } from '@/lib/theme';
import { crossedMilestone } from '@/lib/streak';
import { useSession } from '@/lib/session';
import { fmt, useStrings } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/settings';

function Spark({ i, total }: { i: number; total: number }) {
  const { width, height } = useWindowDimensions();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(i * 25, withTiming(1, { duration: 1400 }));
  }, [i, t]);
  const angle = (i / total) * Math.PI * 2;
  const r = Math.min(width, height) * 0.45;
  const a = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ translateX: Math.cos(angle) * r * t.value }, { translateY: Math.sin(angle) * r * t.value - 80 * t.value }, { scale: 0.6 + t.value }],
  }));
  return <Animated.Text style={[styles.spark, a]}>{i % 3 ? '🔥' : '❤️'}</Animated.Text>;
}

export function MilestoneCelebration() {
  const { couple } = useSession();
  const s = useStrings();
  const reduce = useReducedMotion();
  const prev = useRef<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const scale = useSharedValue(0.4);

  useEffect(() => {
    const cur = couple?.streak_count ?? null;
    if (prev.current != null && cur != null) {
      const m = crossedMilestone(prev.current, cur);
      if (m) {
        setShown(m);
        haptic.success();
        setTimeout(() => haptic.success(), 350);
        scale.value = 0.4;
        scale.value = withSpring(1, { damping: 8, stiffness: 120 });
        setTimeout(() => setShown(null), 3200);
      }
    }
    prev.current = cur;
  }, [couple?.streak_count, scale]);

  const a = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  if (!shown) return null;
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="none">
      <View style={styles.center}>
        {!reduce && Array.from({ length: 18 }, (_, i) => <Spark key={i} i={i} total={18} />)}
        <Animated.View style={[styles.center, a]}>
          <Txt style={styles.big}>🔥</Txt>
          <Txt variant="hero" center>{fmt(s.streak.milestone, { n: shown })}</Txt>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: 'rgba(11,7,9,0.7)', zIndex: 500 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  big: { fontSize: 96, lineHeight: 120 },
  spark: { position: 'absolute', fontSize: 28, color: colors.text },
});
