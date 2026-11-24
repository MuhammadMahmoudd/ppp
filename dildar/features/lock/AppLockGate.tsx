/**
 * Wraps the whole app:
 *  • Face ID / passcode on every cold open and after 60s in background
 *  • blur cover while inactive (iOS app switcher) + native switcher protection
 *  • quick-hide: shake or long-press logo → fake calculator
 */
import React, { useEffect, useRef } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import * as ScreenCapture from 'expo-screen-capture';
import { Accelerometer } from 'expo-sensors';
import { settingsStore, useSettings } from '@/lib/settings';
import { colors } from '@/lib/theme';
import { lockStore, useLock, quickHide } from './lockStore';
import { LockScreen } from './LockScreen';
import { FakeCalculator } from './FakeCalculator';
import { stopPattern } from '@/lib/haptics';

const AUTO_LOCK_MS = 60_000;

export function AppLockGate({ children, enabled, skipInitialLock }: { children: React.ReactNode; enabled: boolean; skipInitialLock?: boolean }) {
  const { locked, hidden, cover } = useLock();
  const { faceIdOnOpen, quickHideShake } = useSettings();
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    if (!faceIdOnOpen) lockStore.set((s) => ({ ...s, locked: false }));
    if (Platform.OS !== 'web') ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (enabled && skipInitialLock) lockStore.set((s) => ({ ...s, locked: false }));
    // only when the gate first becomes active
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      const s = settingsStore.get();
      if (st === 'inactive') lockStore.set((l) => ({ ...l, cover: true }));
      if (st === 'background') {
        backgroundAt.current = Date.now();
        lockStore.set((l) => ({ ...l, cover: true }));
        stopPattern();
      }
      if (st === 'active') {
        const away = backgroundAt.current ? Date.now() - backgroundAt.current : 0;
        backgroundAt.current = null;
        const shouldLock = Platform.OS !== 'web' && s.faceIdOnOpen && s.autoLock && away > AUTO_LOCK_MS;
        lockStore.set((l) => ({ ...l, cover: false, locked: l.locked || shouldLock }));
      }
    });
    return () => sub.remove();
  }, []);

  // Shake detection (a quick spike above ~2.3g).
  useEffect(() => {
    if (!quickHideShake || !enabled || Platform.OS === 'web') return;
    let last = 0;
    Accelerometer.setUpdateInterval(120);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const g = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (g > 2.3 && now - last > 1500) {
        last = now;
        if (!lockStore.get().hidden) quickHide();
      }
    });
    return () => sub.remove();
  }, [quickHideShake, enabled]);

  const showLock = enabled && locked && !hidden;
  return (
    <View style={styles.root}>
      {children}
      {showLock && <LockScreen />}
      {enabled && hidden && <FakeCalculator />}
      {cover && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bg } });
