import React from 'react';
import { Text, type TextProps, StyleSheet } from 'react-native';
import { colors, type as typo } from '@/lib/theme';
import { localizeDigits } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';

type Variant = keyof typeof typo;
export type TxtProps = TextProps & { variant?: Variant; color?: string; center?: boolean; muted?: boolean };

/** Text with the Kurdish font, direction-aware alignment and localized digits. */
export function Txt({ variant = 'body', color, center, muted, style, children, ...rest }: TxtProps) {
  const { kurdishNumerals } = useSettings();
  const content = typeof children === 'string' ? localizeDigits(children, kurdishNumerals) : children;
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[
        typo[variant],
        styles.base,
        { color: color ?? (muted ? colors.textMuted : colors.text) },
        center && styles.center,
        style,
      ]}
    >
      {content}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { writingDirection: 'auto', textAlign: 'auto' },
  center: { textAlign: 'center' },
});
