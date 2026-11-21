import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressy } from '@/components/Pressy';
import { Txt } from '@/components/Txt';
import { colors, radius, space } from '@/lib/theme';

export function Segmented<T extends string>({ value, options, onChange, disabled }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <View style={styles.row}>
      {options.map((o) => (
        <Pressy key={o.value} hapticStyle="select" disabled={disabled} onPress={() => onChange(o.value)} style={[styles.seg, o.value === value && styles.on]}>
          <Txt variant="small" color={o.value === value ? colors.text : colors.textMuted} center>{o.label}</Txt>
        </Pressy>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: colors.surface },
  seg: { flex: 1, paddingVertical: space.sm, borderRadius: radius.pill, alignItems: 'center' },
  on: { backgroundColor: colors.accent },
});
