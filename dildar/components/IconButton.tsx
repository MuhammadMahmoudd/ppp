import React from 'react';
import { I18nManager, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pressy } from './Pressy';
import { colors } from '@/lib/theme';
import { Txt } from './Txt';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function IconButton({ name, onPress, onLongPress, size = 22, color = colors.text, label, badge, style, glass = true, flipRTL }: {
  name: IconName; onPress?: () => void; onLongPress?: () => void; size?: number; color?: string; label: string; badge?: number; style?: StyleProp<ViewStyle>; glass?: boolean; /** mirror the icon in RTL (arrows) */ flipRTL?: boolean;
}) {
  return (
    <Pressy onPress={onPress} onLongPress={onLongPress} accessibilityLabel={label} hitSlop={8} style={[styles.btn, glass && styles.glass, style]}>
      <Ionicons name={name} size={size} color={color} style={flipRTL && I18nManager.isRTL ? styles.flip : undefined} />
      {badge ? (
        <View style={styles.badge}><Txt variant="tiny" color={colors.text}>{badge > 9 ? '9+' : String(badge)}</Txt></View>
      ) : null}
    </Pressy>
  );
}

const styles = StyleSheet.create({
  btn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  glass: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  flip: { transform: [{ scaleX: -1 }] },
  badge: { position: 'absolute', top: -2, end: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
});
