/**
 * Snap-style horizontal pager: Chat ← Camera → Games. Opens on Camera.
 * RTL-aware: in Kurdish, Chat sits on the right (reading start).
 * Child gestures (swipe-to-reply, drawing) can block the pager through
 * usePager().gesture, and editors can disable swiping entirely.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { I18nManager, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

type PanGesture = ReturnType<typeof Gesture.Pan>;
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { springs } from '@/lib/theme';
import { haptic } from '@/lib/haptics';
import { setPresenceScreen } from '@/lib/realtime';

export const PAGES = ['chat', 'camera', 'games'] as const;
export type PageName = (typeof PAGES)[number];

type PagerCtx = {
  index: number;
  progress: SharedValue<number>; // animated page index (0..2)
  goTo: (p: PageName) => void;
  setSwipeEnabled: (on: boolean) => void;
  gesture: PanGesture;
};
const Ctx = createContext<PagerCtx | null>(null);

export function usePager(): PagerCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePager outside Pager');
  return c;
}

export function Pager({ render, initial = 'camera' }: { render: (p: PageName, active: boolean) => React.ReactNode; initial?: PageName }) {
  const { width } = useWindowDimensions();
  const dir = I18nManager.isRTL ? -1 : 1;
  const [index, setIndex] = useState(PAGES.indexOf(initial));
  const [swipe, setSwipe] = useState(true);
  const progress = useSharedValue(PAGES.indexOf(initial));
  const start = useSharedValue(0);

  const commit = useCallback((i: number) => {
    setIndex(i);
    haptic.select();
    setPresenceScreen(PAGES[i]);
  }, []);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(swipe)
        .activeOffsetX([-18, 18])
        .failOffsetY([-14, 14])
        .onBegin(() => {
          start.value = progress.value;
        })
        .onUpdate((e) => {
          let p = start.value - (e.translationX * dir) / width;
          if (p < 0) p = p / 3; // rubber band at the ends
          if (p > PAGES.length - 1) p = PAGES.length - 1 + (p - (PAGES.length - 1)) / 3;
          progress.value = p;
        })
        .onEnd((e) => {
          const v = -(e.velocityX * dir) / width;
          let target = Math.round(progress.value + v * 0.25);
          target = Math.max(0, Math.min(PAGES.length - 1, target));
          if (Math.abs(target - start.value) > 1) target = start.value + Math.sign(target - start.value);
          progress.value = withSpring(target, springs.snappy);
          if (target !== Math.round(start.value)) runOnJS(commit)(target);
        }),
    [swipe, dir, width, progress, start, commit],
  );

  const goTo = useCallback(
    (p: PageName) => {
      const i = PAGES.indexOf(p);
      progress.value = withSpring(i, springs.snappy);
      if (i !== index) commit(i);
    },
    [index, progress, commit],
  );

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -progress.value * width * dir }] }));

  const ctx = useMemo<PagerCtx>(() => ({ index, progress, goTo, setSwipeEnabled: setSwipe, gesture }), [index, progress, goTo, gesture]);

  return (
    <Ctx.Provider value={ctx}>
      <GestureDetector gesture={gesture}>
        <View style={styles.clip}>
          <Animated.View style={[StyleSheet.absoluteFill, rowStyle]}>
            {PAGES.map((p, i) => (
              <View key={p} style={[styles.page, { width, left: i * width * dir, direction: I18nManager.isRTL ? 'rtl' : 'ltr' }]}>
                {render(p, i === index)}
              </View>
            ))}
          </Animated.View>
        </View>
      </GestureDetector>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  clip: { flex: 1, overflow: 'hidden', direction: 'ltr' },
  page: { position: 'absolute', top: 0, bottom: 0 },
});
