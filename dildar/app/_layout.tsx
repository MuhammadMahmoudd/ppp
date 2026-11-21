import '@/lib/polyfills';
import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useFonts, Vazirmatn_400Regular, Vazirmatn_600SemiBold, Vazirmatn_800ExtraBold } from '@expo-google-fonts/vazirmatn';
import { DevSettings, StyleSheet } from 'react-native';
import { loadSettings } from '@/lib/settings';
import { applyDirection } from '@/lib/i18n';
import { startQueue } from '@/lib/offlineQueue';
import { wipeTemp } from '@/lib/media';
import { colors } from '@/lib/theme';
import { SessionProvider, useSession, type Stage } from '@/lib/session';
import { AppLockGate } from '@/features/lock/AppLockGate';
import { AppServices } from '@/features/home/AppServices';
import { NotConfigured } from '@/features/home/NotConfigured';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const ROUTE_FOR: Record<Exclude<Stage, 'loading' | 'unconfigured'>, string> = {
  signedOut: '/(auth)/welcome',
  needsKeys: '/setup/keys',
  needsPairing: '/setup/pair',
  needsProfile: '/setup/profile',
  ready: '/',
};
const GROUP_FOR: Record<Exclude<Stage, 'loading' | 'unconfigured'>, string> = {
  signedOut: '(auth)',
  needsKeys: 'setup',
  needsPairing: 'setup',
  needsProfile: 'setup',
  ready: '(main)',
};

function StageRouter() {
  const { stage } = useSession();
  const segments = useSegments() as string[];
  useEffect(() => {
    if (stage === 'loading' || stage === 'unconfigured') return;
    const group = segments[0];
    const leaf = segments[1];
    const want = ROUTE_FOR[stage];
    if (group !== GROUP_FOR[stage]) router.replace(want as never);
    else if (group === 'setup' && `/setup/${leaf}` !== want) router.replace(want as never);
    SplashScreen.hideAsync().catch(() => undefined);
  }, [stage, segments]);
  return null;
}

const SETUP_STAGES: Stage[] = ['signedOut', 'needsKeys', 'needsPairing', 'needsProfile'];

function Shell() {
  const { stage } = useSession();
  // If the user just went through sign-in/setup, don't ask for Face ID again
  // right away; the lock applies from the next open / 60s in background.
  const didSetup = useRef(false);
  if (SETUP_STAGES.includes(stage)) didSetup.current = true;
  if (stage === 'unconfigured') return <NotConfigured />;
  return (
    <AppLockGate enabled={stage === 'ready'} skipInitialLock={didSetup.current}>
      <StageRouter />
      {stage === 'ready' && <AppServices />}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }}>
        <Stack.Screen name="(main)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="setup" />
      </Stack>
    </AppLockGate>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Vazirmatn_400Regular, Vazirmatn_600SemiBold, Vazirmatn_800ExtraBold });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      if (applyDirection(s.locale)) {
        // RTL/LTR switch only takes effect after a reload.
        import('expo-updates')
          .then((U) => U.reloadAsync())
          .catch(() => DevSettings.reload());
        return;
      }
      wipeTemp();
      startQueue();
      setReady(true);
    });
  }, []);

  if (!fontsLoaded || !ready) return null;
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <KeyboardProvider statusBarTranslucent>
          <StatusBar style="light" />
          <SessionProvider>
            <Shell />
          </SessionProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bg } });
