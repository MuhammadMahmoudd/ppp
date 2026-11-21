import React, { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, radius, space } from '@/lib/theme';
import { Txt } from './Txt';

type Props = TextInputProps & { label?: string; error?: string | null };

export const Input = forwardRef<React.ComponentRef<typeof TextInput>, Props>(function Input({ label, error, style, ...rest }, ref) {
  return (
    <View style={styles.wrap}>
      {label ? <Txt variant="small" muted>{label}</Txt> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.rose}
        keyboardAppearance="dark"
        {...rest}
        style={[styles.input, !!error && styles.inputError, style]}
      />
      {error ? <Txt variant="small" color={colors.danger}>{error}</Txt> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    writingDirection: 'auto',
  },
  inputError: { borderColor: colors.danger },
});
