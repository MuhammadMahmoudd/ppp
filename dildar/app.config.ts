import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Dynamic Expo config. Secrets never live here; public Supabase values come
 * from EXPO_PUBLIC_* env vars (see .env.example) and EAS project id from
 * EAS_PROJECT_ID (filled by `eas init`).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'دڵدار',
  slug: 'dildar',
  scheme: 'dildar',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0B0709',
  ios: {
    bundleIdentifier: 'com.surchy.dildar',
    supportsTablet: false,
    usesAppleSignIn: true,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      // English defaults; Kurdish versions live in ./locales/ckb.json
      NSCameraUsageDescription: 'Dildar uses the camera so you can send snaps to your partner.',
      NSMicrophoneUsageDescription: 'Dildar uses the microphone for voice notes and video snaps.',
      NSPhotoLibraryUsageDescription: 'Dildar lets you pick photos to send privately to your partner.',
      NSPhotoLibraryAddUsageDescription: 'Dildar saves a photo to your library only when you tap Save.',
      NSFaceIDUsageDescription: 'Dildar uses Face ID to keep your private space locked.',
      CFBundleDevelopmentRegion: 'ckb',
      CFBundleAllowMixedLocalizations: true,
      UIBackgroundModes: ['remote-notification'],
    },
  },
  locales: {
    ckb: './locales/ckb.json',
    en: './locales/en.json',
  },
  android: {
    package: 'com.surchy.dildar',
    adaptiveIcon: {
      backgroundColor: '#0B0709',
      foregroundImage: './assets/android-icon-foreground.png',
    },
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    'expo-secure-store',
    'expo-apple-authentication',
    'expo-localization',
    'expo-font',
    [
      'expo-camera',
      {
        cameraPermission: 'Dildar uses the camera so you can send snaps to your partner.',
        microphonePermission: 'Dildar uses the microphone for voice notes and video snaps.',
        recordAudioAndroid: true,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Dildar lets you pick photos to send privately to your partner.',
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission: 'Dildar uses the microphone for voice notes and video snaps.',
      },
    ],
    [
      'expo-local-authentication',
      { faceIDPermission: 'Dildar uses Face ID to keep your private space locked.' },
    ],
    [
      'expo-notifications',
      { color: '#FF4D6D' },
    ],
    'expo-video',
    [
      'expo-splash-screen',
      { backgroundColor: '#0B0709', image: './assets/splash-icon.png', imageWidth: 160 },
    ],
  ],
  experiments: { typedRoutes: true },
  updates: process.env.EAS_PROJECT_ID
    ? { url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}` }
    : undefined,
  runtimeVersion: { policy: 'appVersion' },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});
