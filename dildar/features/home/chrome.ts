import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const TOP_BAR_HEIGHT = 56;
export const BOTTOM_NAV_HEIGHT = 64;

/** Space pages must leave for the floating top bar / bottom nav. */
export function useChromeInsets() {
  const i = useSafeAreaInsets();
  return { top: i.top + TOP_BAR_HEIGHT, bottom: i.bottom + BOTTOM_NAV_HEIGHT, safeTop: i.top, safeBottom: i.bottom };
}
