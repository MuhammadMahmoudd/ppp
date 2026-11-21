import React from 'react';
import { I18nManager, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pressy } from './Pressy';
import { Txt } from './Txt';
import { colors, space } from '@/lib/theme';
import { haptic } from '@/lib/haptics';
import type { IconName } from './IconButton';

type Props = {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  toggle?: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean };
  danger?: boolean;
};

export function ListRow({ icon, title, subtitle, value, onPress, toggle, danger }: Props) {
  const body = (
    <View style={styles.row}>
      {icon ? <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.rose} /> : null}
      <View style={styles.flex}>
        <Txt color={danger ? colors.danger : undefined}>{title}</Txt>
        {subtitle ? <Txt variant="small" muted>{subtitle}</Txt> : null}
      </View>
      {value ? <Txt variant="small" muted>{value}</Txt> : null}
      {toggle ? (
        <Switch
          value={toggle.value}
          disabled={toggle.disabled}
          onValueChange={(v) => { haptic.select(); toggle.onChange(v); }}
          trackColor={{ true: colors.accent, false: colors.surfaceStrong }}
          thumbColor={colors.text}
        />
      ) : onPress ? (
        <Ionicons name={I18nManager.isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textFaint} />
      ) : null}
    </View>
  );
  if (onPress && !toggle) return <Pressy onPress={onPress} scaleTo={0.98}>{body}</Pressy>;
  return body;
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 52 },
  flex: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
