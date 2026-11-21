import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '@/lib/theme';
import { loadEncryptedImage } from '@/lib/media';
import { useSession } from '@/lib/session';
import type { ProfileRow } from '@/lib/database.types';
import { Txt } from './Txt';

/** Avatars are E2E encrypted too, so we decrypt before showing. */
export function Avatar({ profile, size = 40, ring }: { profile: ProfileRow | null; size?: number; ring?: boolean }) {
  const { sharedKey, keyPair } = useSession();
  const [uri, setUri] = useState<string | null>(null);
  const path = profile?.avatar_path;
  const nonce = profile?.avatar_nonce;
  useEffect(() => {
    let alive = true;
    if (path && nonce && sharedKey) {
      loadEncryptedImage('avatars', path, nonce, sharedKey).then((u) => alive && setUri(u)).catch(() => alive && setUri(null));
    } else setUri(null);
    return () => {
      alive = false;
    };
  }, [path, nonce, sharedKey, keyPair]);
  const initial = (profile?.display_name || '♥').trim().charAt(0);
  const inner = (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Txt variant="heading" style={{ fontSize: size * 0.42, lineHeight: size * 0.6 }}>{initial}</Txt>
      )}
    </View>
  );
  if (!ring) return inner;
  return (
    <LinearGradient colors={gradients.accent} style={{ padding: 2, borderRadius: size }}>
      {inner}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
