/** Full view of one vault item, decrypted in memory (temp file for video/voice, wiped on close). */
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Pressy } from '@/components/Pressy';
import { Txt } from '@/components/Txt';
import { ErrorState, Skeleton } from '@/components/States';
import { colors, radius, space } from '@/lib/theme';
import { fmt, num, relativeTime, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { api } from '@/lib/api';
import { bytesToDataUri, deleteTempFile, downloadAndDecrypt, writeTempFile } from '@/lib/media';
import { haptic } from '@/lib/haptics';
import { useScreenGuard } from '@/features/security/useScreenGuard';
import { fetchVaultItem, useVault, type VaultItem } from './useVault';
import { cancelDeleteRequest, deleteVaultItem, moveToAlbum } from './actions';

function VideoBody({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => p.play());
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls allowsPictureInPicture={false} />;
}

function VoiceBody({ uri }: { uri: string }) {
  const s = useStrings();
  const player = useAudioPlayer({ uri });
  const st = useAudioPlayerStatus(player);
  const pct = st.duration > 0 ? st.currentTime / st.duration : 0;
  const t = Math.floor(st.currentTime);
  return (
    <View style={styles.voice}>
      <Pressy
        onPress={() => {
          if (st.playing) player.pause();
          else {
            if (st.duration > 0 && st.currentTime >= st.duration - 0.1) player.seekTo(0);
            player.play();
          }
        }}
        accessibilityLabel={st.playing ? s.vault.pause : s.vault.play}
        style={styles.playBtn}
      >
        <Ionicons name={st.playing ? 'pause' : 'play'} size={40} color={colors.text} />
      </Pressy>
      <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]} /></View>
      <Txt muted>{`${num(Math.floor(t / 60))}:${num(String(t % 60).padStart(2, '0'))}`}</Txt>
    </View>
  );
}

export function VaultItemViewer({ id }: { id: string }) {
  const s = useStrings();
  const insets = useSafeAreaInsets();
  const { couple, userId, sharedKey, me, partner } = useSession();
  const { albums, requests, reload } = useVault(couple?.id ?? null, sharedKey);
  const [item, setItem] = useState<VaultItem | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'gone'>('loading');
  const [busy, setBusy] = useState(false);
  useScreenGuard('vault', id);

  useEffect(() => {
    let alive = true;
    let temp: string | null = null;
    (async () => {
      if (!sharedKey) return;
      const it = await fetchVaultItem(id, sharedKey);
      if (!alive) return;
      if (!it) return setState('gone');
      setItem(it);
      try {
        const bytes = await downloadAndDecrypt('vault', it.storage_path, it.nonce, sharedKey);
        if (!alive) return;
        if (it.kind === 'image') setSrc(bytesToDataUri(bytes, it.meta.mime ?? 'image/jpeg'));
        else {
          temp = await writeTempFile(bytes, it.meta.ext ?? (it.kind === 'voice' ? 'm4a' : 'mp4'));
          if (!alive) return deleteTempFile(temp);
          setSrc(temp);
        }
        setState('ready');
      } catch {
        if (alive) setState('error');
      }
    })();
    return () => {
      alive = false;
      if (temp) deleteTempFile(temp);
    };
  }, [id, sharedKey]);

  const request = requests.find((r) => r.item_id === id);

  const del = () =>
    Alert.alert(s.vault.deleteConfirm, couple?.vault_delete_protection ? s.vault.protectionOn : undefined, [
      { text: s.common.cancel, style: 'cancel' },
      {
        text: request && request.requested_by !== userId ? s.vault.agreeDelete : s.common.delete,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const r = await deleteVaultItem(id);
            haptic.success();
            if (r === 'deleted') router.back();
            else {
              await reload();
              Alert.alert(s.vault.deleteRequested);
            }
          } catch {
            haptic.error();
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  const move = () =>
    Alert.alert(s.vault.moveToAlbum, undefined, [
      { text: s.vault.noAlbum, onPress: () => moveToAlbum(id, null).then(() => { haptic.success(); }) },
      ...albums.map((a) => ({ text: a.name, onPress: () => moveToAlbum(id, a.id).then(() => { haptic.success(); }) })),
      { text: s.common.cancel, style: 'cancel' as const },
    ]);

  const uploader = item?.uploader_id === userId ? me : partner;

  return (
    <View style={styles.root}>
      <View style={styles.media}>
        {state === 'loading' && <Skeleton width="100%" height={420} style={{ borderRadius: radius.xl }} />}
        {state === 'error' && <ErrorState />}
        {state === 'gone' && <Txt muted center>{s.vault.deleted}</Txt>}
        {state === 'ready' && src && item?.kind === 'image' && <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="contain" />}
        {state === 'ready' && src && item?.kind === 'video' && <VideoBody uri={src} />}
        {state === 'ready' && src && item?.kind === 'voice' && <VoiceBody uri={src} />}
      </View>

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <IconButton name="chevron-back" label={s.common.back} onPress={() => router.back()} flipRTL />
        {item && (
          <View style={styles.meta}>
            <Txt variant="small">{fmt(s.vault.uploadedBy, { name: uploader?.display_name || '' })}</Txt>
            <Txt variant="tiny" muted>{relativeTime(new Date(item.created_at), s)}</Txt>
          </View>
        )}
        <View style={{ width: 42 }} />
      </View>

      {item && (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]}>
          {request && (
            <View style={styles.pending}>
              <Ionicons name="hourglass-outline" size={16} color={colors.warning} />
              <Txt variant="small" color={colors.warning} style={styles.flex}>
                {request.requested_by === userId ? s.vault.waitingPartner : fmt(s.vault.partnerWantsDelete, { n: 1 })}
              </Txt>
              {request.requested_by === userId && (
                <Button small variant="ghost" title={s.common.cancel} onPress={() => cancelDeleteRequest(id).then(reload)} />
              )}
            </View>
          )}
          <View style={styles.actions}>
            <Button small variant="glass" title={s.vault.moveToAlbum} onPress={move} icon={<Ionicons name="albums-outline" size={16} color={colors.text} />} />
            <Button
              small
              variant="danger"
              loading={busy}
              title={request && request.requested_by !== userId ? s.vault.agreeDelete : s.common.delete}
              onPress={del}
              disabled={!!request && request.requested_by === userId}
              icon={<Ionicons name="trash-outline" size={16} color={colors.text} />}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  media: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.lg },
  top: { position: 'absolute', top: 0, start: 0, end: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg },
  meta: { alignItems: 'center' },
  bottom: { position: 'absolute', bottom: 0, start: 0, end: 0, paddingHorizontal: space.lg, gap: space.md },
  pending: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: 'rgba(255,200,97,0.12)', padding: space.sm, borderRadius: radius.md },
  actions: { flexDirection: 'row', gap: space.md, justifyContent: 'center' },
  voice: { alignItems: 'center', gap: space.lg, alignSelf: 'stretch' },
  playBtn: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: colors.surfaceStrong, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.rose },
});
