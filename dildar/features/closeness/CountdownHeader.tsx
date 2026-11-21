/**
 * Big countdown to the next visit, shown at the top of the Chat tab.
 * No countdown yet → a compact "add one" call to action.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Txt } from '@/components/Txt';
import { Pressy } from '@/components/Pressy';
import { Skeleton } from '@/components/States';
import { colors, radius, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { useCountdown, useNow } from './hooks';
import { CountdownDigits } from './ui';
import { countdownParts } from './logic';

export function CountdownHeader({ compact }: { compact?: boolean } = {}) {
  const s = useStrings();
  const { row, title, loaded } = useCountdown();
  const now = useNow(1000);
  const open = () => router.push('/closeness/countdown');

  if (!loaded) return <View style={styles.wrap}><Skeleton height={compact ? 48 : 110} /></View>;

  if (!row) {
    return (
      <Pressy onPress={open} style={styles.wrap} scaleTo={0.98}>
        <View style={styles.empty}>
          <Txt style={styles.emoji}>✈️</Txt>
          <View style={styles.flex}>
            <Txt variant="heading">{s.closeness.countdown.noneTitle}</Txt>
            <Txt variant="small" muted>{s.closeness.countdown.add}</Txt>
          </View>
        </View>
      </Pressy>
    );
  }

  const arrived = countdownParts(row.target_at, now).arrived;
  return (
    <Animated.View entering={FadeIn}>
      <Pressy onPress={open} style={styles.wrap} scaleTo={0.98}>
        <LinearGradient colors={['rgba(255,77,109,0.22)', 'rgba(201,24,74,0.08)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <Txt variant="small" muted center>
            {arrived ? s.closeness.countdown.arrived : fmt(s.closeness.countdown.untilLabel, { title: title || s.closeness.countdown.defaultTitle })}
          </Txt>
          {!arrived && <CountdownDigits targetIso={row.target_at} now={now} compact={compact} />}
          {arrived && <Txt style={styles.emoji} center>❤️</Txt>}
        </LinearGradient>
      </Pressy>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: space.lg, marginVertical: space.sm },
  card: { borderRadius: radius.xl, padding: space.md, gap: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,107,139,0.35)' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  emoji: { fontSize: 28, lineHeight: 38 },
  flex: { flex: 1 },
});
