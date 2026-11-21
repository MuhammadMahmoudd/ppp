import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { colors, gradients, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';
import { unlock } from './lockStore';

export function LockScreen() {
  const s = useStrings();
  const [failed, setFailed] = useState(false);
  const tryUnlock = async () => {
    const ok = await unlock();
    if (ok) haptic.success();
    else {
      haptic.error();
      setFailed(true);
    }
  };
  useEffect(() => {
    tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(220)} style={[StyleSheet.absoluteFill, styles.root]}>
      <LinearGradient colors={gradients.night} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <LinearGradient colors={gradients.accent} style={styles.logo}>
          <Ionicons name="heart" size={44} color={colors.text} />
        </LinearGradient>
        <Txt variant="title" center>{s.lock.title}</Txt>
        {failed && <Txt muted center>{s.lock.failed}</Txt>}
      </View>
      <View style={styles.bottom}>
        <Button title={s.lock.unlock} onPress={tryUnlock} icon={<Ionicons name="scan-outline" size={20} color={colors.text} />} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 1000, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  logo: { width: 96, height: 96, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  bottom: { padding: space.xl, paddingBottom: 56 },
});
