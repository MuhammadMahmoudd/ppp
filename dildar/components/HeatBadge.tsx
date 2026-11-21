import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, radius } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import type { Heat } from '@/lib/database.types';
import { Txt } from './Txt';

export const HEAT_EMOJI: Record<Heat, string> = { 1: '🙂', 2: '😏', 3: '🔥', 4: '❤️‍🔥' };

export function HeatBadge({ heat, compact }: { heat: Heat; compact?: boolean }) {
  const s = useStrings();
  return (
    <LinearGradient colors={gradients.heat[heat]} style={styles.badge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
      <Txt variant="tiny">{compact ? HEAT_EMOJI[heat] : `${HEAT_EMOJI[heat]} ${s.heat[heat]}`}</Txt>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2, alignSelf: 'flex-start' },
});
