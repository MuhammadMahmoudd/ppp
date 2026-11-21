import { STARTER_BY_KEY } from './ynmStarter';
import type { CustomItem } from './api';
import type { Locale } from '@/lib/settings';

/** Label for a starter key ('s:…') or a custom item id. */
export function itemLabel(key: string, locale: Locale, custom: CustomItem[]): string | null {
  const st = STARTER_BY_KEY[key];
  if (st) return st[locale];
  return custom.find((c) => c.key === key)?.text ?? null;
}
