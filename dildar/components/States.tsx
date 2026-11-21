import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { useOnline } from '@/lib/offlineQueue';
import { useReducedMotion } from '@/lib/settings';
import { Txt } from './Txt';
import { Button } from './Button';

/** Skeletons instead of spinners. */
export function Skeleton({ width = '100%', height = 16, style, round }: { width?: number | `${number}%`; height?: number; style?: StyleProp<ViewStyle>; round?: boolean }) {
  const o = useSharedValue(0.35);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!reduce) o.value = withRepeat(withTiming(0.8, { duration: 850 }), -1, true);
  }, [o, reduce]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width, height, borderRadius: round ? height / 2 : radius.sm, backgroundColor: colors.surfaceStrong }, a, style]} />;
}

export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <View style={{ gap: space.md, padding: space.lg }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <Skeleton width={44} height={44} round />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width={`${60 + ((i * 13) % 30)}%`} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function EmptyState({ emoji = '🌙', title, body, action }: { emoji?: string; title?: string; body?: string; action?: { label: string; onPress: () => void } }) {
  const s = useStrings();
  return (
    <View style={styles.center}>
      <Txt style={styles.emoji}>{emoji}</Txt>
      <Txt variant="heading" center>{title ?? s.states.emptyTitle}</Txt>
      {body ? <Txt muted center>{body}</Txt> : null}
      {action ? <Button title={action.label} onPress={action.onPress} variant="glass" small /> : null}
    </View>
  );
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const s = useStrings();
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
      <Txt variant="heading" center>{s.states.errorTitle}</Txt>
      <Txt muted center>{message ?? s.states.errorBody}</Txt>
      {onRetry ? <Button title={s.common.retry} onPress={onRetry} variant="glass" small /> : null}
    </View>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  const s = useStrings();
  if (online) return null;
  return (
    <Animated.View entering={FadeInDown} exiting={FadeOutUp} style={styles.offline}>
      <Ionicons name="wifi-outline" size={14} color={colors.bg} />
      <Txt variant="tiny" color={colors.bg}>{s.states.offline}</Txt>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xxl },
  emoji: { fontSize: 48, lineHeight: 60 },
  offline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
    backgroundColor: colors.warning, paddingVertical: 4, marginHorizontal: space.lg, borderRadius: radius.pill,
  },
});
