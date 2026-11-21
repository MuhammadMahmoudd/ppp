import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radius, space } from '@/lib/theme';

/** Soft glass card. */
export function Glass({ children, style, padded = true, intensity = 30 }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean; intensity?: number }) {
  return (
    <View style={[styles.wrap, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[styles.tint, padded && styles.pad]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tint: { backgroundColor: colors.surface },
  pad: { padding: space.lg },
});
