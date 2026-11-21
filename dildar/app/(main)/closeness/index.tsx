/** Closeness hub (نزیکایەتی): every "feel close from far away" tool. */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Txt } from '@/components/Txt';
import { space } from '@/lib/theme';
import { formatClock } from '@/lib/time';
import { fmt, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { CountdownHeader } from '@/features/closeness/CountdownHeader';
import { MissYouButton } from '@/features/closeness/MissYouButton';
import { Tile } from '@/features/closeness/ui';
import { useNow } from '@/features/closeness/hooks';

export default function ClosenessHub() {
  const s = useStrings();
  const c = s.closeness;
  const { partner } = useSession();
  const now = useNow(30_000);
  return (
    <Screen scroll header={<Header title={c.title} />}>
      <View style={styles.intro}>
        <Txt muted center>{c.hubSubtitle}</Txt>
        {partner ? <Txt variant="small" muted center>{fmt(s.profile.localTime, { time: formatClock(new Date(now), partner.timezone) })}</Txt> : null}
      </View>
      <MissYouButton />
      <View style={styles.bleed}><CountdownHeader /></View>
      <View style={styles.grid}>
        <Tile emoji="🫶" title={c.touch.title} subtitle={c.touch.body} onPress={() => router.push('/closeness/touch')} />
        <Tile emoji="💬" title={c.question.title} onPress={() => router.push('/closeness/question')} />
        <Tile emoji="⏰" title={c.scheduler.title} subtitle={c.scheduler.body} onPress={() => router.push('/closeness/scheduler')} />
        <Tile emoji="💌" title={c.envelopes.title} subtitle={c.envelopes.body} onPress={() => router.push('/closeness/envelopes')} />
        <Tile emoji="✈️" title={c.countdown.title} subtitle={c.countdown.planTitle} onPress={() => router.push('/closeness/countdown')} />
        <Tile emoji="🌙" title={c.sleep.title} subtitle={c.sleep.body} onPress={() => router.push('/closeness/sleep')} />
        <Tile emoji="🌍" title={c.lists.bucket} subtitle={c.lists.bucketBody} onPress={() => router.push({ pathname: '/closeness/lists/[kind]', params: { kind: 'bucket' } })} />
        <Tile emoji="🎟️" title={c.lists.coupon} subtitle={c.lists.couponBody} onPress={() => router.push({ pathname: '/closeness/lists/[kind]', params: { kind: 'coupon' } })} />
        <Tile emoji="📸" title={c.lists.memory} subtitle={c.lists.memoryBody} wide onPress={() => router.push({ pathname: '/closeness/lists/[kind]', params: { kind: 'memory' } })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 4 },
  bleed: { marginHorizontal: -space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});
