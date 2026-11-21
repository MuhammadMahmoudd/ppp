import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Pressy } from '@/components/Pressy';
import { Txt } from '@/components/Txt';
import { HEAT_EMOJI } from '@/components/HeatBadge';
import { colors, gradients, radius, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import type { Heat } from '@/lib/database.types';

/** 4-step heat "slider". Levels above maxHeat show a lock. */
export function HeatPicker({ value, onChange, maxHeat = 4, disabled }: { value: Heat; onChange: (h: Heat) => void; maxHeat?: Heat; disabled?: boolean }) {
  const s = useStrings();
  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityValue={{ min: 1, max: 4, now: value }}>
      {([1, 2, 3, 4] as Heat[]).map((h) => {
        const locked = h > maxHeat;
        const on = h === value;
        return (
          <Pressy key={h} hapticStyle="select" disabled={locked || disabled} onPress={() => onChange(h)} style={styles.flex} accessibilityLabel={s.heat[h]}>
            {on ? (
              <LinearGradient colors={gradients.heat[h]} style={styles.seg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Txt variant="heading">{HEAT_EMOJI[h]}</Txt>
                <Txt variant="tiny">{s.heat[h]}</Txt>
              </LinearGradient>
            ) : (
              <View style={[styles.seg, styles.off, locked && styles.locked]}>
                {locked ? <Ionicons name="lock-closed" size={16} color={colors.textFaint} /> : <Txt variant="heading">{HEAT_EMOJI[h]}</Txt>}
                <Txt variant="tiny" muted>{s.heat[h]}</Txt>
              </View>
            )}
          </Pressy>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  seg: { borderRadius: radius.md, alignItems: 'center', paddingVertical: space.sm, minHeight: 58, justifyContent: 'center' },
  off: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  locked: { opacity: 0.45 },
});
