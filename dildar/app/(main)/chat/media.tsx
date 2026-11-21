/** Full-screen viewer for encrypted chat photos/videos (decrypted in memory / temp file). */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { IconButton } from '@/components/IconButton';
import { ErrorState } from '@/components/States';
import { colors, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { bytesToDataUri, deleteTempFile, downloadAndDecrypt, writeTempFile } from '@/lib/media';
import { localMediaUri } from '@/features/chat/actions';

function Video({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={styles.full} contentFit="contain" nativeControls allowsPictureInPicture={false} />;
}

export default function ChatMedia() {
  const s = useStrings();
  const { sharedKey } = useSession();
  const p = useLocalSearchParams<{ path: string; nonce: string; kind: 'image' | 'video'; mime?: string; id?: string }>();
  const [uri, setUri] = useState<string | null>(p.id ? localMediaUri(p.id) ?? null : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (uri || !sharedKey || !p.path || !p.nonce) return;
    let temp: string | null = null;
    let alive = true;
    downloadAndDecrypt('chat-media', p.path, p.nonce, sharedKey)
      .then(async (bytes) => {
        if (p.kind === 'video') {
          temp = await writeTempFile(bytes, 'mp4');
          if (alive) setUri(temp);
        } else if (alive) setUri(bytesToDataUri(bytes, p.mime || 'image/jpeg'));
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (temp) deleteTempFile(temp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedKey, p.path, p.nonce]);

  // swipe down to dismiss
  const y = useSharedValue(0);
  const pan = Gesture.Pan()
    .activeOffsetY(20)
    .onUpdate((e) => {
      y.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120) runOnJS(router.back)();
      else y.value = withSpring(0);
    });
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: 1 - Math.min(0.6, y.value / 400) }));

  return (
    <View style={styles.root}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.full, a]}>
          {failed ? <ErrorState /> : !uri ? <ActivityIndicator style={styles.full} color={colors.text} /> : p.kind === 'video' ? <Video uri={uri} /> : <Image source={{ uri }} style={styles.full} contentFit="contain" />}
        </Animated.View>
      </GestureDetector>
      <SafeAreaView style={styles.top} edges={['top']} pointerEvents="box-none">
        <IconButton name="close" label={s.common.close} onPress={() => router.back()} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  full: { flex: 1 },
  top: { position: 'absolute', top: 0, start: space.lg },
});
