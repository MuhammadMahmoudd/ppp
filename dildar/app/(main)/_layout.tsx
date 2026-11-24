import { Stack } from 'expo-router';
import { View } from 'react-native';
import { colors } from '@/lib/theme';
import { useSession } from '@/lib/session';

export default function MainLayout() {
  const { stage } = useSession();
  // Don't mount the camera/chat/etc. until signed in + paired; the root
  // StageRouter redirects to sign-in / setup meanwhile.
  if (stage !== 'ready') return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
    </Stack>
  );
}
