import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Skeleton } from '@/components/States';
import { Txt } from '@/components/Txt';
import { colors, radius } from '@/lib/theme';
import { haptic } from '@/lib/haptics';
import { loadEncryptedImage } from '@/lib/media';
import type { VaultItem } from './useVault';

/** Thumbnail stays blurred; long-press peeks while held. */
export function VaultThumb({ item, size, keyBytes, pending, onOpen }: { item: VaultItem; size: number; keyBytes: Uint8Array | null; pending?: boolean; onOpen: () => void }) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [peek, setPeek] = useState(false);

  useEffect(() => {
    let alive = true;
    if (item.kind === 'image' && keyBytes) {
      loadEncryptedImage('vault', item.storage_path, item.nonce, keyBytes, item.meta.mime ?? 'image/jpeg')
        .then((u) => alive && setUri(u))
        .catch(() => alive && setFailed(true));
    }
    return () => {
      alive = false;
    };
  }, [item.kind, item.storage_path, item.nonce, item.meta.mime, keyBytes]);

  return (
    <Pressable
      onPress={onOpen}
      onLongPress={() => { haptic.soft(); setPeek(true); }}
      onPressOut={() => setPeek(false)}
      delayLongPress={250}
      style={[styles.tile, { width: size, height: size }]}
      accessibilityRole="imagebutton"
    >
      {item.kind === 'image' ? (
        uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={peek ? 0 : 40} transition={120} />
        ) : failed ? (
          <View style={styles.icon}><Ionicons name="alert-circle-outline" size={24} color={colors.textMuted} /></View>
        ) : (
          <Skeleton width={size} height={size} style={{ borderRadius: 0 }} />
        )
      ) : (
        <View style={[styles.icon, item.kind === 'voice' && styles.voice]}>
          <Ionicons name={item.kind === 'video' ? 'videocam' : 'mic'} size={28} color={colors.text} />
          {item.meta.duration ? <Txt variant="tiny" muted>{`${Math.round(item.meta.duration > 1000 ? item.meta.duration / 1000 : item.meta.duration)}s`}</Txt> : null}
        </View>
      )}
      {pending && (
        <View style={styles.pending}><Ionicons name="hourglass-outline" size={14} color={colors.text} /></View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.bgElevated },
  icon: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: 'rgba(201,24,74,0.25)' },
  voice: { backgroundColor: 'rgba(255,138,101,0.2)' },
  pending: { position: 'absolute', top: 4, end: 4, backgroundColor: colors.warning, borderRadius: 10, padding: 3 },
});
