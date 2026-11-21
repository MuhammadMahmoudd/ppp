import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Txt } from '@/components/Txt';
import { colors, gradients, radius, space } from '@/lib/theme';
import { useReducedMotion } from '@/lib/settings';
import { haptic } from '@/lib/haptics';
import type { Heat } from '@/lib/database.types';

/** A card that flips (3D) to reveal its face whenever `faceKey` changes. */
export function FlipCard({ faceKey, title, body, heat = 1, footer, emoji = '♥' }: { faceKey: string | null; title?: string; body?: string; heat?: Heat; footer?: React.ReactNode; emoji?: string }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(faceKey ? 1 : 0);
  useEffect(() => {
    if (!faceKey) {
      t.value = reduce ? withTiming(0, { duration: 150 }) : withSpring(0);
      return;
    }
    t.value = 0;
    t.value = reduce ? withTiming(1, { duration: 200 }) : withSpring(1, { damping: 14, stiffness: 120 });
    haptic.soft();
  }, [faceKey, reduce, t]);

  const back = useAnimatedStyle(() =>
    reduce
      ? { opacity: 1 - t.value }
      : { opacity: t.value < 0.5 ? 1 : 0, transform: [{ perspective: 900 }, { rotateY: `${interpolate(t.value, [0, 1], [0, 180])}deg` }] },
  );
  const front = useAnimatedStyle(() =>
    reduce
      ? { opacity: t.value }
      : { opacity: t.value >= 0.5 ? 1 : 0, transform: [{ perspective: 900 }, { rotateY: `${interpolate(t.value, [0, 1], [-180, 0])}deg` }] },
  );

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.card, back]}>
        <LinearGradient colors={gradients.accent} style={[StyleSheet.absoluteFill, styles.center]}>
          <Txt style={styles.emoji}>{emoji}</Txt>
        </LinearGradient>
      </Animated.View>
      <Animated.View style={[styles.card, styles.face, front]}>
        <LinearGradient colors={gradients.heat[heat]} style={styles.stripe} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
        {title ? <Txt variant="tiny" muted center>{title}</Txt> : null}
        <View style={styles.center}>
          <Txt variant="title" center style={styles.body}>{body ?? ''}</Txt>
        </View>
        {footer}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 0.78, maxHeight: 360, alignSelf: 'center' },
  card: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, borderRadius: radius.xl, overflow: 'hidden', backfaceVisibility: 'hidden' },
  face: { backgroundColor: colors.bgElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: space.lg, gap: space.sm },
  stripe: { position: 'absolute', top: 0, start: 0, end: 0, height: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 64, lineHeight: 80 },
  body: { fontSize: 22, lineHeight: 36 },
});
