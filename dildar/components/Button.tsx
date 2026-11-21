import React from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressy } from './Pressy';
import { Txt } from './Txt';
import { colors, gradients, radius, space } from '@/lib/theme';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'glass' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
  testID?: string;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, icon, style, small, testID }: Props) {
  const inactive = disabled || loading;
  const content = (
    <View style={[styles.inner, small && styles.small]}>
      {loading ? <ActivityIndicator color={colors.text} /> : icon}
      <Txt variant={small ? 'small' : 'heading'} color={variant === 'ghost' ? colors.rose : colors.text}>
        {title}
      </Txt>
    </View>
  );
  return (
    <Pressy
      testID={testID}
      onPress={inactive ? undefined : onPress}
      hapticStyle={inactive ? 'none' : 'tap'}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[styles.base, small && styles.baseSmall, inactive && styles.disabled, style]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.fill, variant === 'glass' && styles.glass, variant === 'danger' && styles.danger]}>{content}</View>
      )}
    </Pressy>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, overflow: 'hidden', minHeight: 54 },
  baseSmall: { minHeight: 38, borderRadius: radius.md },
  fill: { flex: 1, justifyContent: 'center' },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.md },
  small: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  glass: { backgroundColor: colors.surfaceStrong, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  danger: { backgroundColor: 'rgba(255,90,95,0.18)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.danger },
  disabled: { opacity: 0.5 },
});
