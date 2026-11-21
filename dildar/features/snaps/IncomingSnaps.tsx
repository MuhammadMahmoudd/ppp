/** Glowing stack of unopened snaps from the partner (above the shutter). */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeOutDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Pressy } from '@/components/Pressy';
import { Txt } from '@/components/Txt';
import { colors, gradients, radius, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useReducedMotion } from '@/lib/settings';
import { useIncomingSnaps } from './useIncomingSnaps';

export function IncomingSnaps() {
  const s = useStrings();
  const { couple, userId, partner } = useSession();
  const { snaps } = useIncomingSnaps(couple?.id ?? null, userId);
  const reduce = useReducedMotion();
  const glow = useSharedValue(0.5);
  useEffect(() => {
    if (!reduce) glow.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0.5, { duration: 900 })), -1);
  }, [glow, reduce]);
  const a = useAnimatedStyle(() => ({ opacity: glow.value }));
  if (!snaps.length) return null;
  const name = partner?.display_name || s.common.partner;
  const spicy = snaps.some((x) => x.spicy_blur);
  return (
    <Animated.View entering={FadeInDown.springify()} exiting={FadeOutDown}>
      <Pressy onPress={() => router.push({ pathname: '/snap/[id]', params: { id: snaps[0].id } })} accessibilityLabel={s.snaps.tapToOpen}>
        <View style={styles.pill}>
          <Animated.View style={[StyleSheet.absoluteFill, a]}>
            <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.round]} />
          </Animated.View>
          <View style={styles.stack}>
            {snaps.slice(0, 3).map((x, i) => (
              <View key={x.id} style={[styles.card, { transform: [{ rotate: `${(i - 1) * 8}deg` }], zIndex: 3 - i }]}>
                <Ionicons name={x.media_kind === 'video' ? 'videocam' : spicy && x.spicy_blur ? 'flame' : 'image'} size={14} color={colors.text} />
              </View>
            ))}
          </View>
          <View>
            <Txt variant="heading">{snaps.length > 1 ? fmt(s.snaps.newSnaps, { n: snaps.length, name }) : fmt(s.snaps.newSnap, { name })}</Txt>
            <Txt variant="tiny" muted>{s.snaps.tapToOpen}</Txt>
          </View>
        </View>
      </Pressy>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.lg, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: 'rgba(20,13,16,0.6)' },
  round: { borderRadius: radius.pill },
  stack: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  card: { position: 'absolute', width: 24, height: 32, borderRadius: 6, backgroundColor: colors.deepRed, borderWidth: 1.5, borderColor: colors.text, alignItems: 'center', justifyContent: 'center' },
});
