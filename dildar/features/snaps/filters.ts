import type { ViewStyle } from 'react-native';
import type { FilterId } from './overlay';

/** Filters are tint layers over the media (cheap, work for video too). */
export const FILTER_LAYERS: Record<FilterId, ViewStyle[]> = {
  none: [],
  warm: [{ backgroundColor: 'rgba(255,138,61,0.16)' }],
  rose: [{ backgroundColor: 'rgba(255,77,109,0.18)' }],
  night: [{ backgroundColor: 'rgba(20,24,80,0.32)' }],
  noir: [{ backgroundColor: '#808080', mixBlendMode: 'saturation' }],
  vintage: [{ backgroundColor: 'rgba(112,66,20,0.22)' }, { backgroundColor: 'rgba(255,230,180,0.08)' }],
};
