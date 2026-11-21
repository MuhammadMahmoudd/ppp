import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Glass } from '@/components/Glass';
import { Pressy } from '@/components/Pressy';
import { Txt } from '@/components/Txt';
import type { IconName } from '@/components/IconButton';
import { colors, radius, space } from '@/lib/theme';
import { useReducedMotion } from '@/lib/settings';

export function ToolCard({ icon, title, body, onPress, index = 0, badge }: { icon: IconName; title: string; body: string; onPress: () => void; index?: number; badge?: string | null }) {
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.delay(60 * index).springify()} style={styles.flex}>
      <Pressy onPress={onPress} scaleTo={0.97}>
        <Glass style={styles.card}>
          <View style={styles.icon}><Ionicons name={icon} size={22} color={colors.rose} /></View>
          <View style={styles.flex}>
            <Txt variant="heading">{title}</Txt>
            <Txt variant="small" muted>{body}</Txt>
          </View>
          {badge ? <View style={styles.badge}><Txt variant="tiny">{badge}</Txt></View> : null}
        </Glass>
      </Pressy>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: 'rgba(255,77,109,0.14)', alignItems: 'center', justifyContent: 'center' },
  badge: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
});
