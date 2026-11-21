import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Txt } from '@/components/Txt';
import { gradients, radius, space } from '@/lib/theme';
import { useReducedMotion } from '@/lib/settings';

/** One die; tumbles whenever `seq` changes (both phones share seq + result). */
export function DieView({ label, face, seq }: { label: string; face: string; seq: number }) {
  const reduce = useReducedMotion();
  const rot = useSharedValue(0);
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!seq || reduce) return;
    rot.value = 0;
    rot.value = withTiming(720, { duration: 650 });
    scale.value = withSequence(withTiming(0.7, { duration: 220 }), withSpring(1, { damping: 7, stiffness: 160 }));
  }, [seq, reduce, rot, scale]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }, { scale: scale.value }] }));
  return (
    <Animated.View style={[styles.die, a]}>
      <LinearGradient colors={gradients.accent} style={styles.fill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Txt variant="tiny" muted center numberOfLines={1}>{label}</Txt>
        <Txt variant="heading" center numberOfLines={3} adjustsFontSizeToFit>{face}</Txt>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  die: { width: 132, height: 132, borderRadius: radius.lg, overflow: 'hidden' },
  fill: { flex: 1, padding: space.sm, alignItems: 'center', justifyContent: 'center', gap: 4 },
});
