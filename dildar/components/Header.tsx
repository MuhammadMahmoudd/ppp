import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { colors, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { IconButton } from './IconButton';
import { Txt } from './Txt';

/** Simple stack header with a direction-aware back arrow. */
export function Header({ title, right, onBack }: { title: string; right?: React.ReactNode; onBack?: () => void }) {
  const s = useStrings();
  return (
    <View style={styles.row}>
      <IconButton name="chevron-back" label={s.common.back} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} flipRTL />
      <Txt variant="heading" style={styles.title} numberOfLines={1}>{title}</Txt>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { flex: 1, textAlign: 'center' },
  side: { minWidth: 42, alignItems: 'flex-end' },
});
