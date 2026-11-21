import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressy } from '@/components/Pressy';
import { Txt } from '@/components/Txt';
import { colors, radius, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import type { YnmAnswer } from '@/lib/database.types';

const COLOR: Record<YnmAnswer, string> = { yes: colors.success, maybe: colors.warning, no: colors.textMuted };
const ORDER: YnmAnswer[] = ['yes', 'maybe', 'no'];

/** Segmented Yes / Maybe / No. Tapping the active answer clears it. */
export function AnswerPills({ value, onChange, large }: { value: YnmAnswer | undefined; onChange: (a: YnmAnswer | null) => void; large?: boolean }) {
  const s = useStrings();
  const label: Record<YnmAnswer, string> = { yes: s.spicy.ynm.yes, maybe: s.spicy.ynm.maybe, no: s.spicy.ynm.no };
  return (
    <View style={styles.row}>
      {ORDER.map((a) => {
        const on = value === a;
        return (
          <Pressy
            key={a}
            hapticStyle="select"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label[a]}
            onPress={() => onChange(on ? null : a)}
            style={[styles.pill, large && styles.large, on && { backgroundColor: COLOR[a], borderColor: COLOR[a] }]}
          >
            <Txt variant={large ? 'heading' : 'small'} color={on ? colors.bg : colors.textMuted}>{label[a]}</Txt>
          </Pressy>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xs },
  pill: { paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  large: { flex: 1, paddingVertical: space.md },
});
