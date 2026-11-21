import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/Avatar';
import { IconButton } from '@/components/IconButton';
import { Pressy } from '@/components/Pressy';
import { colors, gradients, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { usePresence } from '@/lib/realtime';
import { haptic } from '@/lib/haptics';
import { StreakBadge } from '@/features/streaks/StreakBadge';
import { quickHide } from '@/features/lock/lockStore';
import { TOP_BAR_HEIGHT } from './chrome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Floating top bar: settings · logo (hold = quick-hide) · streak · vault · spicy. */
export function TopBar() {
  const s = useStrings();
  const { me, partner, spicyActive } = useSession();
  const { partnerOnline } = usePresence();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top, height: insets.top + TOP_BAR_HEIGHT }]} pointerEvents="box-none">
      <LinearGradient colors={['rgba(11,7,9,0.85)', 'rgba(11,7,9,0)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.row} pointerEvents="box-none">
        <View style={styles.side}>
          <Pressy onPress={() => router.push('/settings')} accessibilityLabel={s.nav.settings}>
            <Avatar profile={me} size={38} />
          </Pressy>
          <View>
            <Avatar profile={partner} size={30} />
            <View style={[styles.dot, { backgroundColor: partnerOnline ? colors.success : colors.textFaint }]} />
          </View>
        </View>
        <Pressy
          onLongPress={() => { haptic.heavy(); quickHide(); }}
          delayLongPress={450}
          accessibilityLabel={s.appName}
          hapticStyle="none"
        >
          <LinearGradient colors={gradients.accent} style={styles.logo}>
            <Ionicons name="heart" size={18} color={colors.text} />
          </LinearGradient>
        </Pressy>
        <View style={[styles.side, styles.end]}>
          <StreakBadge onPress={() => router.push('/streak')} />
          <IconButton name="heart-outline" label={s.nav.closeness} onPress={() => router.push('/closeness' as never)} />
          {spicyActive && <IconButton name="flame" color={colors.coral} label={s.nav.spicy} onPress={() => router.push('/spicy')} />}
          <IconButton name="lock-closed-outline" label={s.nav.vault} onPress={() => router.push('/vault')} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, start: 0, end: 0, zIndex: 50 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, justifyContent: 'space-between' },
  side: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 },
  end: { justifyContent: 'flex-end' },
  logo: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', bottom: 0, end: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.bg },
});
