/**
 * i18n: Sorani (RTL) first, English optional. Components read strings with
 * `const s = useStrings()` → `s.chat.title`, and format with `fmt()`.
 */
import { I18nManager } from 'react-native';
import { ckb, type Strings } from '@/i18n/ckb';
import { en } from '@/i18n/en';
import { settingsStore, useSettings, updateSettings, type Locale } from './settings';

const TABLE: Record<Locale, Strings> = { ckb, en };

export function stringsFor(locale: Locale): Strings {
  return TABLE[locale];
}

export function useStrings(): Strings {
  return TABLE[useSettings().locale];
}

export function currentStrings(): Strings {
  return TABLE[settingsStore.get().locale];
}

const EASTERN = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Latin → Eastern Arabic/Kurdish digits (when the setting is on). */
export function localizeDigits(text: string, kurdish = settingsStore.get().kurdishNumerals): string {
  return kurdish ? text.replace(/[0-9]/g, (d) => EASTERN[Number(d)]) : text;
}

export function num(n: number | string): string {
  return localizeDigits(String(n));
}

/** "{n} ڕۆژ" + {n: 3} → "3 ڕۆژ" (digits localized per setting). */
export function fmt(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = params[k];
    if (v === undefined) return `{${k}}`;
    return typeof v === 'number' ? num(v) : v;
  });
}

export const isRTL = (): boolean => I18nManager.isRTL;

/**
 * Applies the layout direction for the saved locale. Returns true when the
 * direction changed and the app must reload for it to take effect.
 */
export function applyDirection(locale: Locale): boolean {
  const wantRTL = locale === 'ckb';
  I18nManager.allowRTL(wantRTL);
  if (I18nManager.isRTL !== wantRTL) {
    I18nManager.forceRTL(wantRTL);
    return true;
  }
  return false;
}

export async function setLocale(locale: Locale): Promise<void> {
  updateSettings({ locale });
  if (applyDirection(locale)) {
    const Updates = await import('expo-updates');
    try {
      await Updates.reloadAsync();
    } catch {
      // In dev, expo-updates can't reload: the DevSettings fallback below does.
      const { DevSettings } = await import('react-native');
      DevSettings.reload();
    }
  }
}

/** Relative time like "5 min" / "Yesterday" using the active strings. */
export function relativeTime(date: Date, s: Strings, now = new Date()): string {
  const diff = Math.max(0, now.getTime() - date.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return s.common.now;
  if (min < 60) return fmt(s.common.minutes, { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return fmt(s.common.hours, { n: h });
  const d = Math.floor(h / 24);
  if (d === 1) return s.common.yesterday;
  return fmt(s.common.days, { n: d });
}
