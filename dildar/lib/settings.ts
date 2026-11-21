/**
 * Per-device preferences (non-sensitive) persisted in AsyncStorage.
 * The vault PIN hash lives in SecureStore (see features/vault/pin.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo } from 'react-native';
import { createStore, useStore } from './store';

export type Locale = 'ckb' | 'en';

export type Settings = {
  locale: Locale;
  kurdishNumerals: boolean;
  haptics: boolean;
  reduceMotion: boolean;
  faceIdOnOpen: boolean;
  autoLock: boolean;
  quickHideShake: boolean;
  chatDisappearDefault: 'off' | 'view' | '24h';
};

const DEFAULTS: Settings = {
  locale: 'ckb',
  kurdishNumerals: false,
  haptics: true,
  reduceMotion: false,
  faceIdOnOpen: true,
  autoLock: true,
  quickHideShake: true,
  chatDisappearDefault: 'off',
};

const KEY = 'dildar.settings.v1';
export const settingsStore = createStore<Settings>(DEFAULTS);
let systemReduceMotion = false;

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) settingsStore.set({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) });
  } catch {
    // keep defaults
  }
  try {
    systemReduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
  } catch {
    systemReduceMotion = false;
  }
  return settingsStore.get();
}

export function updateSettings(patch: Partial<Settings>): void {
  settingsStore.set((s) => ({ ...s, ...patch }));
  AsyncStorage.setItem(KEY, JSON.stringify(settingsStore.get())).catch(() => undefined);
}

export function useSettings(): Settings {
  return useStore(settingsStore);
}

/** True when the user (app setting) or iOS asks for less motion. */
export function prefersReducedMotion(): boolean {
  return settingsStore.get().reduceMotion || systemReduceMotion;
}

export function useReducedMotion(): boolean {
  const s = useSettings();
  return s.reduceMotion || systemReduceMotion;
}
