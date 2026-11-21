import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Pressy } from '@/components/Pressy';
import { colors, radius, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { PAGES, usePager, type PageName } from './Pager';
import { BOTTOM_NAV_HEIGHT } from './chrome';

const ICON: Record<PageName, React.ComponentProps<typeof Ionicons>['name']> = { chat: 'chatbubble-ellipses', camera: 'camera', games: 'dice' };

function Tab({ page, i }: { page: PageName; i: number }) {
  const s = useStrings();
  const { progress, goTo } = usePager();
  const a = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(progress.value - i));
    return {
      backgroundColor: interpolateColor(d, [0, 1], ['rgba(255,77,109,0.95)', 'rgba(255,255,255,0)']),
      transform: [{ scale: 1.06 - d * 0.06 }],
    };
  });
  return (
    <Pressy onPress={() => goTo(page)} accessibilityLabel={s.nav[page]} style={styles.tabWrap} hapticStyle="select">
      <Animated.View style={[styles.tab, a]}>
        <Ionicons name={ICON[page]} size={20} color={colors.text} />
      </Animated.View>
    </Pressy>
  );
}

export function BottomNav() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: insets.bottom + space.sm }]} pointerEvents="box-none">
      <View style={styles.bar}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        {PAGES.map((p, i) => <Tab key={p} page={p} i={i} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 0, end: 0, alignItems: 'center', zIndex: 50 },
  bar: { flexDirection: 'row', height: BOTTOM_NAV_HEIGHT - 12, borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: 6, alignItems: 'center', gap: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: 'rgba(20,13,16,0.5)' },
  tabWrap: { borderRadius: radius.pill },
  tab: { width: 64, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
