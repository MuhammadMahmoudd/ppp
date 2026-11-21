/**
 * Every interaction has haptics: light on tap, medium on send, success on
 * streak milestones, rigid on dice. Long-distance touch patterns too.
 */
import * as Haptics from 'expo-haptics';
import { settingsStore } from './settings';

const enabled = () => settingsStore.get().haptics;
const safe = (p: Promise<void>) => p.catch(() => undefined);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const haptic = {
  tap: () => enabled() && safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select: () => enabled() && safe(Haptics.selectionAsync()),
  send: () => enabled() && safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => enabled() && safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  rigid: () => enabled() && safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),
  soft: () => enabled() && safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  success: () => enabled() && safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => enabled() && safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => enabled() && safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

export type TouchPattern = 'heartbeat' | 'slow' | 'tease' | 'long' | 'tap';
type Step = { style: Haptics.ImpactFeedbackStyle; wait: number };
const { Light, Medium, Heavy, Soft, Rigid } = Haptics.ImpactFeedbackStyle;

export const PATTERNS: Record<TouchPattern, Step[]> = {
  tap: [{ style: Medium, wait: 0 }],
  heartbeat: [
    { style: Heavy, wait: 0 }, { style: Medium, wait: 140 },
    { style: Heavy, wait: 650 }, { style: Medium, wait: 140 },
    { style: Heavy, wait: 650 }, { style: Medium, wait: 140 },
  ],
  slow: [
    { style: Soft, wait: 0 }, { style: Soft, wait: 600 }, { style: Light, wait: 600 },
    { style: Soft, wait: 600 }, { style: Light, wait: 600 },
  ],
  tease: [
    { style: Light, wait: 0 }, { style: Light, wait: 90 }, { style: Light, wait: 90 },
    { style: Medium, wait: 400 }, { style: Light, wait: 90 }, { style: Rigid, wait: 500 },
  ],
  long: Array.from({ length: 14 }, (_, i) => ({ style: i % 2 ? Soft : Medium, wait: i === 0 ? 0 : 70 })),
};

let playing = 0;
/** Plays a pattern; a newer call cancels an older one. */
export async function playPattern(p: TouchPattern): Promise<void> {
  if (!enabled()) return;
  const id = ++playing;
  for (const step of PATTERNS[p]) {
    if (step.wait) await sleep(step.wait);
    if (id !== playing) return;
    await safe(Haptics.impactAsync(step.style));
  }
}

export function stopPattern(): void {
  playing++;
}
