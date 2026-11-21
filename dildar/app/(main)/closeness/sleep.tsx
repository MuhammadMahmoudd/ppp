/**
 * Sleep mode: a calm dark screen with a soft heartbeat haptic.
 * Beats sit on a shared wall-clock grid (Date.now() mod period), so when
 * both of you are here (presence screen 'sleep') the phones beat together.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Txt } from '@/components/Txt';
import { Button } from '@/components/Button';
import { space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { haptic } from '@/lib/haptics';
import { setPresenceScreen, usePresence } from '@/lib/realtime';
import { msUntilNextBeat } from '@/features/closeness/logic';
import { BeatingHeart } from '@/features/closeness/ui';

export default function SleepMode() {
  const s = useStrings();
  const sl = s.closeness.sleep;
  const settings = useSettings();
  const { partnerScreen, partnerOnline } = usePresence();
  const together = partnerOnline && partnerScreen === 'sleep';
  const [beat, setBeat] = useState(0);
  const togetherRef = useRef(together);
  togetherRef.current = together;

  useEffect(() => {
    setPresenceScreen('sleep');
    return () => setPresenceScreen('home');
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      setBeat((b) => b + 1);
      haptic.soft();
      // second, lighter beat ("lub-dub"); stronger together
      setTimeout(() => alive && (togetherRef.current ? haptic.tap() : haptic.soft()), 220);
      timer = setTimeout(tick, msUntilNextBeat(Date.now() + 5) + 5);
    };
    timer = setTimeout(tick, msUntilNextBeat());
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <SafeAreaView style={styles.flex}>
        <View style={styles.center}>
          <BeatingHeart beat={beat} size={170} together={together} />
          <Animated.View key={String(together)} entering={FadeIn.duration(800)} style={styles.text}>
            <Txt variant="heading" center color="rgba(247,238,240,0.7)">{sl.title}</Txt>
            <Txt center muted>{together ? sl.together : sl.alone}</Txt>
            {!settings.haptics ? <Txt center variant="small" muted>{sl.hapticsOff}</Txt> : null}
          </Animated.View>
        </View>
        <View style={styles.bottom}>
          <Txt variant="small" center muted>{sl.body}</Txt>
          <Button title={sl.exit} variant="glass" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050304' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xxl, padding: space.xl },
  text: { gap: space.sm },
  bottom: { padding: space.xl, gap: space.md },
});
