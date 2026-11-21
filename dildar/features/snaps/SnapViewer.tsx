/**
 * Snap viewer.
 *  • decrypts in memory (image → data: URI; video → temp file deleted on close)
 *  • timer bar, tap = close/next, hold = keep on screen (pauses the timer)
 *  • spicy blur: must tap-and-hold to reveal (timer only runs while revealed)
 *  • first reveal calls the `snap_opened` Edge Function (marks viewed and
 *    deletes the storage object) — view-once
 *  • screenshot detection + recording block (useScreenGuard)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';
import Animated, { Easing, FadeIn, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Skeleton } from '@/components/States';
import { Txt } from '@/components/Txt';
import { colors, radius, space } from '@/lib/theme';
import { fmt, relativeTime, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { tryOpenJSON } from '@/lib/crypto';
import { bytesToDataUri, deleteTempFile, downloadAndDecrypt, encryptAndUpload, writeTempFile } from '@/lib/media';
import { sealJSON } from '@/lib/crypto';
import { haptic } from '@/lib/haptics';
import { notifyPartner } from '@/lib/push';
import type { SnapRow } from '@/lib/database.types';
import { useScreenGuard } from '@/features/security/useScreenGuard';
import { decodeMeta, type SnapMeta } from './overlay';
import { OverlayView } from './OverlayView';
import { nextUnopenedSnap } from './useIncomingSnaps';

type Phase = 'loading' | 'ready' | 'own' | 'opened' | 'expired' | 'notFound' | 'error';
type Media = { kind: 'image'; uri: string } | { kind: 'video'; uri: string };

const IMAGE_LOOP_MS = 10_000; // ∞ images: progress bar just cycles

function SnapVideo({ uri, loop, paused, onProgress, onEnd }: { uri: string; loop: boolean; paused: boolean; onProgress: (p: number) => void; onEnd: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
    p.timeUpdateEventInterval = 0.1;
    p.play();
  });
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (player.duration > 0) onProgress(currentTime / player.duration);
  });
  useEventListener(player, 'playToEnd', () => {
    if (!loop) onEnd();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

export function SnapViewer({ id }: { id: string }) {
  const s = useStrings();
  const insets = useSafeAreaInsets();
  const { userId, couple, sharedKey, partner } = useSession();
  const [phase, setPhase] = useState<Phase>('loading');
  const [row, setRow] = useState<SnapRow | null>(null);
  const [meta, setMeta] = useState<SnapMeta | null>(null);
  const [media, setMedia] = useState<Media | null>(null);
  const [holding, setHolding] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [saved, setSaved] = useState<'no' | 'saving' | 'yes'>('no');
  const bytes = useRef<Uint8Array | null>(null);
  const reported = useRef(false);
  const closing = useRef(false);
  const progress = useSharedValue(0);
  const pressAt = useRef(0);

  useScreenGuard('snap', id, phase === 'ready');

  // ── load + decrypt ──
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!userId || !sharedKey) return;
      const { data, error } = await supabase.from('snaps').select('*').eq('id', id).maybeSingle();
      if (!alive) return;
      if (error) return setPhase('error');
      if (!data) return setPhase('notFound');
      setRow(data);
      if (data.sender_id === userId) return setPhase('own');
      if (data.opened_at) return setPhase('opened');
      if (!data.storage_path || new Date(data.expires_at).getTime() < Date.now()) return setPhase('expired');
      try {
        const m = decodeMeta(tryOpenJSON(data.meta_ciphertext, data.meta_nonce, sharedKey));
        const plain = await downloadAndDecrypt('snaps', data.storage_path, data.nonce, sharedKey);
        if (!alive) return;
        bytes.current = plain;
        const mime = m?.mime ?? (data.media_kind === 'video' ? 'video/mp4' : 'image/jpeg');
        if (data.media_kind === 'video') {
          const uri = await writeTempFile(plain, m?.ext ?? 'mp4');
          if (!alive) return deleteTempFile(uri);
          setMedia({ kind: 'video', uri });
        } else {
          setMedia({ kind: 'image', uri: bytesToDataUri(plain, mime) });
        }
        setMeta(m);
        setPhase('ready');
      } catch {
        if (alive) setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, userId, sharedKey]);

  // always wipe the plaintext temp file
  useEffect(() => () => {
    if (media?.kind === 'video') deleteTempFile(media.uri);
    bytes.current = null;
  }, [media]);

  const spicy = !!row?.spicy_blur;
  const revealed = phase === 'ready' && (!spicy || holding);
  const running = revealed && (spicy || !holding);

  // mark opened on first reveal (deletes the stored ciphertext server-side)
  useEffect(() => {
    if (!revealed || reported.current || !row) return;
    reported.current = true;
    haptic.soft();
    supabase.functions.invoke('snap_opened', { body: { snap_id: row.id } }).catch(() => undefined);
  }, [revealed, row]);

  const close = useCallback(async (goNext: boolean) => {
    if (closing.current) return;
    closing.current = true;
    cancelAnimation(progress);
    if (goNext && couple && userId) {
      const next = await nextUnopenedSnap(couple.id, userId, id);
      if (next) return router.replace({ pathname: '/snap/[id]', params: { id: next } });
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [couple, userId, id, progress]);

  // ── image timer (pause/resume with remaining time) ──
  const total = row?.duration ? row.duration * 1000 : IMAGE_LOOP_MS;
  const loop = row?.duration === 0;
  useEffect(() => {
    if (media?.kind !== 'image') return;
    if (!running) {
      cancelAnimation(progress);
      return;
    }
    const remaining = Math.max(50, (1 - progress.value) * total);
    progress.value = withTiming(1, { duration: remaining, easing: Easing.linear }, (done) => {
      if (!done) return;
      if (loop) {
        progress.value = 0;
        runOnJS(restartLoop)();
      } else runOnJS(close)(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, media?.kind, total, loop]);
  const [loopTick, setLoopTick] = useState(0);
  function restartLoop() {
    setLoopTick((t) => t + 1);
  }
  useEffect(() => {
    if (!loopTick || !running) return;
    progress.value = withTiming(1, { duration: total, easing: Easing.linear }, (done) => {
      if (done) {
        progress.value = 0;
        runOnJS(restartLoop)();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopTick]);

  const bar = useAnimatedStyle(() => ({ width: `${Math.min(100, progress.value * 100)}%` }));

  const saveToVault = async () => {
    if (!bytes.current || !couple || !sharedKey || !row || saved !== 'no') return;
    setSaved('saving');
    try {
      const up = await encryptAndUpload('vault', couple.id, bytes.current, sharedKey);
      const m = sealJSON({ mime: meta?.mime ?? 'image/jpeg', ext: meta?.ext ?? 'jpg', from: 'snap' }, sharedKey);
      const { error } = await supabase.from('vault_items').insert({
        couple_id: couple.id,
        kind: row.media_kind,
        storage_path: up.path,
        nonce: up.nonce,
        meta_ciphertext: m.c,
        meta_nonce: m.n,
      });
      if (error) throw error;
      notifyPartner('vault');
      haptic.success();
      setSaved('yes');
    } catch {
      haptic.error();
      setSaved('no');
    }
  };

  // ── non-ready states ──
  if (phase !== 'ready') {
    const icon: Record<Exclude<Phase, 'ready'>, React.ComponentProps<typeof Ionicons>['name']> = {
      loading: 'lock-closed', own: 'paper-plane', opened: 'eye-off', expired: 'time', notFound: 'help-circle', error: 'alert-circle',
    };
    const text = phase === 'own'
      ? (row?.opened_at ? fmt(s.snaps.statusOpened, { time: relativeTime(new Date(row.opened_at), s) }) : s.snaps.statusUnopened)
      : phase === 'opened' ? s.snaps.alreadyOpened
      : phase === 'expired' ? s.snaps.expired
      : phase === 'notFound' ? s.snaps.notFound
      : phase === 'error' ? s.states.decryptFailed
      : s.snaps.decrypting;
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        {phase === 'loading' ? (
          <View style={styles.loading}>
            <Skeleton width={220} height={340} style={{ borderRadius: radius.xl }} />
            <Txt muted center>{s.snaps.decrypting}</Txt>
          </View>
        ) : (
          <Animated.View entering={FadeIn} style={styles.loading}>
            <Ionicons name={icon[phase]} size={56} color={colors.textMuted} />
            {phase === 'own' && <Txt variant="heading" center>{s.snaps.yourSnap}</Txt>}
            <Txt muted center>{text}</Txt>
            <Button title={s.common.close} variant="glass" small onPress={() => close(false)} />
          </Animated.View>
        )}
      </View>
    );
  }

  const name = partner?.display_name || s.common.partner;
  return (
    <View style={styles.root} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Pressable
        style={StyleSheet.absoluteFill}
        delayLongPress={180}
        onPressIn={() => {
          pressAt.current = Date.now();
          setHolding(true);
        }}
        onPressOut={() => setHolding(false)}
        onPress={() => {
          if (Date.now() - pressAt.current < 220 && !spicy) close(true);
        }}
        accessibilityLabel={spicy ? s.snaps.holdToReveal : s.snaps.tapToClose}
      >
        {media?.kind === 'image' && <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
        {media?.kind === 'video' && (
          <SnapVideo uri={media.uri} loop={loop} paused={!running} onProgress={(p) => { progress.value = p; }} onEnd={() => close(true)} />
        )}
        {meta && <OverlayView overlay={meta.overlay} width={size.w} height={size.h} />}
        {spicy && !holding && (
          <View style={StyleSheet.absoluteFill}>
            <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              <Txt style={styles.flame}>🔥</Txt>
              <Txt variant="heading" center>{s.snaps.holdToReveal}</Txt>
            </View>
          </View>
        )}
      </Pressable>

      {/* header: progress + sender */}
      <View style={[styles.header, { paddingTop: insets.top + space.xs }]} pointerEvents="box-none">
        <View style={styles.track}><Animated.View style={[styles.fill, bar]} /></View>
        <View style={styles.headRow} pointerEvents="box-none">
          <View style={styles.sender}>
            <Avatar profile={partner} size={32} />
            <View>
              <Txt variant="small">{name}</Txt>
              {row && <Txt variant="tiny" muted>{relativeTime(new Date(row.created_at), s)}</Txt>}
            </View>
          </View>
          <IconButton name="close" label={s.common.close} onPress={() => close(false)} />
        </View>
      </View>

      {/* footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]} pointerEvents="box-none">
        {!spicy && !holding && <Txt variant="tiny" muted center>{s.snaps.holdToKeep}</Txt>}
        {row?.allow_save && (
          <Button
            small
            variant="glass"
            title={saved === 'yes' ? s.snaps.savedToVault : s.snaps.saveToVault}
            loading={saved === 'saving'}
            disabled={saved === 'yes'}
            onPress={saveToVault}
            icon={<Ionicons name="lock-closed" size={16} color={colors.text} />}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  loading: { alignItems: 'center', gap: space.lg, padding: space.xl },
  flame: { fontSize: 56, lineHeight: 72 },
  header: { position: 'absolute', top: 0, start: 0, end: 0, paddingHorizontal: space.md, gap: space.sm },
  track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  fill: { height: 3, backgroundColor: colors.text },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sender: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  footer: { position: 'absolute', bottom: 0, start: 0, end: 0, alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg },
});
