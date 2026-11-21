/** Encrypted media inside bubbles: images (decrypted in memory), video thumbs, voice notes. */
import React, { memo, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressy } from '@/components/Pressy';
import { Txt } from '@/components/Txt';
import { Skeleton } from '@/components/States';
import { colors, radius, space } from '@/lib/theme';
import { num } from '@/lib/i18n';
import { downloadAndDecrypt, loadEncryptedImage, writeTempFile, deleteTempFile } from '@/lib/media';
import { localMediaUri } from './actions';
import { mmss } from './model';

const MAX_W = 230;

function dims(w?: number, h?: number) {
  if (!w || !h) return { width: MAX_W, height: MAX_W };
  const ratio = Math.min(1.5, Math.max(0.6, h / w));
  return { width: MAX_W, height: Math.round(MAX_W * ratio) };
}

export const EncryptedImage = memo(function EncryptedImage({ id, path, nonce, mime, w, h, keyBytes }: {
  id: string; path: string | null; nonce: string | null; mime: string; w?: number; h?: number; keyBytes: Uint8Array | null;
}) {
  const local = localMediaUri(id);
  const [uri, setUri] = useState<string | null>(local ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (uri || !path || !nonce || !keyBytes) return;
    let alive = true;
    loadEncryptedImage('chat-media', path, nonce, keyBytes, mime)
      .then((u) => alive && setUri(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [path, nonce, keyBytes, mime, uri]);
  const size = dims(w, h);
  if (failed) {
    return (
      <View style={[styles.media, size, styles.center]}>
        <Ionicons name="lock-closed" size={22} color={colors.textMuted} />
      </View>
    );
  }
  if (!uri) return <Skeleton width={size.width} height={size.height} style={styles.media} />;
  return (
    <Pressy
      scaleTo={0.98}
      onPress={() => path && nonce && router.push({ pathname: '/chat/media', params: { path, nonce, kind: 'image', mime, id } } as never)}
    >
      <Image source={{ uri }} style={[styles.media, size]} contentFit="cover" transition={150} />
    </Pressy>
  );
});

export const VideoThumb = memo(function VideoThumb({ id, path, nonce, mime, duration }: { id: string; path: string | null; nonce: string | null; mime: string; duration?: number }) {
  return (
    <Pressy
      scaleTo={0.98}
      onPress={() => path && nonce && router.push({ pathname: '/chat/media', params: { path, nonce, kind: 'video', mime, id } } as never)}
      style={[styles.media, styles.video, styles.center]}
    >
      <View style={styles.play}><Ionicons name="play" size={30} color={colors.text} /></View>
      {duration ? <Txt variant="tiny" style={styles.dur}>{num(mmss(duration))}</Txt> : null}
    </Pressy>
  );
});

function Bars({ wave, progress, mine }: { wave: number[]; progress: number; mine: boolean }) {
  return (
    <View style={styles.bars}>
      {wave.map((v, i) => (
        <View
          key={i}
          style={[styles.bar, { height: 4 + v * 22, backgroundColor: i / wave.length <= progress ? colors.text : mine ? 'rgba(255,255,255,0.45)' : colors.textFaint }]}
        />
      ))}
    </View>
  );
}

const DEFAULT_WAVE = Array.from({ length: 28 }, (_, i) => 0.25 + 0.5 * Math.abs(Math.sin(i * 1.7)));

function LoadedVoice({ uri, duration, wave, mine }: { uri: string; duration: number; wave: number[]; mine: boolean }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  useEffect(() => {
    if (status.didJustFinish) player.seekTo(0).catch(() => undefined);
  }, [status.didJustFinish, player]);
  const total = status.duration || duration || 1;
  const progress = status.currentTime / total;
  const toggle = async () => {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
    if (status.playing) player.pause();
    else player.play();
  };
  return (
    <View style={styles.voice}>
      <Pressy onPress={toggle} style={styles.voiceBtn} accessibilityLabel="play">
        <Ionicons name={status.playing ? 'pause' : 'play'} size={20} color={colors.text} />
      </Pressy>
      <Bars wave={wave} progress={status.playing || status.currentTime > 0 ? progress : 0} mine={mine} />
      <Txt variant="tiny">{num(mmss(status.playing ? status.currentTime : total))}</Txt>
    </View>
  );
}

/** Decrypts on first tap into a temp file (deleted on unmount). */
export const VoiceNote = memo(function VoiceNote({ id, path, nonce, duration, waveform, keyBytes, mine }: {
  id: string; path: string | null; nonce: string | null; duration: number; waveform?: number[]; keyBytes: Uint8Array | null; mine: boolean;
}) {
  const local = localMediaUri(id);
  const [uri, setUri] = useState<string | null>(local ?? null);
  const [busy, setBusy] = useState(false);
  const wave = waveform?.length ? waveform : DEFAULT_WAVE;
  useEffect(() => {
    return () => {
      if (uri && uri !== local) deleteTempFile(uri);
    };
  }, [uri, local]);
  const load = async () => {
    if (!path || !nonce || !keyBytes || busy) return;
    setBusy(true);
    try {
      const bytes = await downloadAndDecrypt('chat-media', path, nonce, keyBytes);
      setUri(await writeTempFile(bytes, 'm4a'));
    } finally {
      setBusy(false);
    }
  };
  if (uri) return <LoadedVoice uri={uri} duration={duration} wave={wave} mine={mine} />;
  return (
    <View style={styles.voice}>
      <Pressy onPress={load} style={styles.voiceBtn} accessibilityLabel="play">
        {busy ? <ActivityIndicator color={colors.text} size="small" /> : <Ionicons name="play" size={20} color={colors.text} />}
      </Pressy>
      <Bars wave={wave} progress={0} mine={mine} />
      <Txt variant="tiny">{num(mmss(duration))}</Txt>
    </View>
  );
});

const styles = StyleSheet.create({
  media: { borderRadius: radius.lg - 4, overflow: 'hidden', backgroundColor: colors.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  video: { width: MAX_W, height: MAX_W * 1.25, backgroundColor: '#1d1216' },
  play: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  dur: { position: 'absolute', bottom: space.sm, end: space.sm, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, borderRadius: 6 },
  voice: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minWidth: 210, paddingVertical: 2 },
  voiceBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 28 },
  bar: { flex: 1, borderRadius: 2 },
});
