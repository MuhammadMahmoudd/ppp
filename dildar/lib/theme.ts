/** Dark, minimal, romantic. Use these tokens — never hard-code colors. */
export const colors = {
  bg: '#0B0709',
  bgElevated: '#140D10',
  surface: 'rgba(255,255,255,0.06)',
  surfaceStrong: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.10)',
  text: '#F7EEF0',
  textMuted: 'rgba(247,238,240,0.62)',
  textFaint: 'rgba(247,238,240,0.38)',
  rose: '#FF6B8B',
  coral: '#FF8A65',
  red: '#C9184A',
  deepRed: '#800F2F',
  accent: '#FF4D6D',
  success: '#5BD6A0',
  warning: '#FFC861',
  danger: '#FF5A5F',
  bubbleMine: '#FF4D6D',
  bubbleTheirs: 'rgba(255,255,255,0.09)',
  overlay: 'rgba(5,3,4,0.72)',
  ice: '#8FD3FF',
} as const;

export const gradients = {
  accent: ['#FF8A65', '#FF4D6D', '#C9184A'] as const,
  fire: ['#FFC861', '#FF6B3D', '#C9184A'] as const,
  night: ['#1A0F14', '#0B0709'] as const,
  heat: {
    1: ['#FFB4C2', '#FF8FA3'] as const,
    2: ['#FF8FA3', '#FF4D6D'] as const,
    3: ['#FF4D6D', '#C9184A'] as const,
    4: ['#C9184A', '#590D22'] as const,
  },
};

export const radius = { sm: 12, md: 16, lg: 20, xl: 24, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const fonts = {
  regular: 'Vazirmatn_400Regular',
  semibold: 'Vazirmatn_600SemiBold',
  bold: 'Vazirmatn_800ExtraBold',
} as const;

export const type = {
  hero: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 48 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 36 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 28 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 26 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 },
  tiny: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16 },
} as const;

export const springs = {
  snappy: { damping: 20, stiffness: 260, mass: 0.8 },
  soft: { damping: 18, stiffness: 140 },
  bouncy: { damping: 10, stiffness: 180 },
} as const;
