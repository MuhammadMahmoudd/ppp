import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Pressy } from '@/components/Pressy';
import { Txt } from '@/components/Txt';
import { colors, space } from '@/lib/theme';
import { num } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';

/** 4–6 digit PIN pad. Always LTR digits order (like the iOS passcode pad). */
export function PinPad({ title, subtitle, error, onSubmit, disabled, autoSubmitAt }: {
  title: string;
  subtitle?: string | null;
  error?: string | null;
  onSubmit: (pin: string) => void;
  disabled?: boolean;
  /** submit automatically once this many digits are typed (e.g. known PIN length) */
  autoSubmitAt?: number;
}) {
  const [pin, setPin] = useState('');
  const shake = useSharedValue(0);
  useEffect(() => {
    if (error) {
      setPin('');
      shake.value = withSequence(withTiming(-12, { duration: 50 }), withTiming(12, { duration: 50 }), withTiming(-8, { duration: 50 }), withTiming(0, { duration: 50 }));
    }
  }, [error, shake]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const press = (d: string) => {
    if (disabled) return;
    haptic.tap();
    const next = (pin + d).slice(0, 6);
    setPin(next);
    if (autoSubmitAt && next.length === autoSubmitAt) {
      setTimeout(() => onSubmit(next), 80);
    }
  };
  const submit = () => {
    if (pin.length >= 4 && !disabled) {
      haptic.send();
      onSubmit(pin);
    }
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];

  return (
    <View style={styles.root}>
      <Txt variant="title" center>{title}</Txt>
      {subtitle ? <Txt muted center variant="small">{subtitle}</Txt> : null}
      <Animated.View style={[styles.dots, a]}>
        {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
          <View key={i} style={[styles.dot, i < pin.length && styles.dotOn]} />
        ))}
      </Animated.View>
      <Txt center color={colors.danger} variant="small">{error ?? ' '}</Txt>
      <View style={styles.pad}>
        {keys.map((k) => (
          <Pressy
            key={k}
            hapticStyle="none"
            onPress={() => (k === 'del' ? (haptic.select(), setPin(pin.slice(0, -1))) : k === 'ok' ? submit() : press(k))}
            accessibilityLabel={k}
            style={[styles.key, (k === 'del' || k === 'ok') && styles.keyGhost, k === 'ok' && pin.length < 4 && styles.dim]}
          >
            {k === 'del' ? (
              <Ionicons name="backspace-outline" size={26} color={colors.text} />
            ) : k === 'ok' ? (
              <Ionicons name="checkmark" size={28} color={colors.rose} />
            ) : (
              <Txt variant="title">{num(k)}</Txt>
            )}
          </Pressy>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xl },
  dots: { flexDirection: 'row', gap: 14, marginTop: space.lg, direction: 'ltr' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.textMuted },
  dotOn: { backgroundColor: colors.rose, borderColor: colors.rose },
  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 288, justifyContent: 'space-between', rowGap: 16, direction: 'ltr' },
  key: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  keyGhost: { backgroundColor: 'transparent' },
  dim: { opacity: 0.35 },
});
