import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptic } from '@/lib/haptics';
import { springs } from '@/lib/theme';
import { useReducedMotion } from '@/lib/settings';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressyProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hapticStyle?: 'tap' | 'select' | 'send' | 'none';
};

/** Pressable with a spring scale + haptic on press. */
export function Pressy({ style, scaleTo = 0.96, hapticStyle = 'tap', onPressIn, onPressOut, onPress, ...rest }: PressyProps) {
  const scale = useSharedValue(1);
  const reduce = useReducedMotion();
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      onPressIn={(e) => {
        if (!reduce) scale.value = withSpring(scaleTo, springs.snappy);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, springs.snappy);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (hapticStyle !== 'none') haptic[hapticStyle]();
        onPress?.(e);
      }}
      style={[style, aStyle]}
    />
  );
}
