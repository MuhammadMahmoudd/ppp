/**
 * Composer: text (+ iOS emoji keyboard), photo/video attach, hold-to-record
 * voice note with slide-to-cancel, per-message disappearing toggle, reply
 * preview and "voice proof for a dare" mode.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, I18nManager, Platform, StyleSheet, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState,
} from 'expo-audio';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from '@/components/Txt';
import { Pressy } from '@/components/Pressy';
import { IconButton } from '@/components/IconButton';
import { colors, fonts, radius, space, springs } from '@/lib/theme';
import { num, useStrings } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';
import { deleteTempFile } from '@/lib/media';
import type { DisappearMode } from '@/lib/database.types';
import { usePager } from '@/features/home/Pager';
import { completeDare, sendMedia, sendText, type ChatCtx } from './actions';
import { useTypingBroadcast } from './useChat';
import { mmss, waveform } from './model';

const CANCEL_DIR = I18nManager.isRTL ? 1 : -1; // slide toward the start side
const CANCEL_AT = 90;
const NEXT_MODE: Record<DisappearMode, DisappearMode> = { off: 'view', view: '24h', '24h': 'off' };

export type ReplyTarget = { id: string; author: string; text: string };

type Props = {
  ctx: ChatCtx | null;
  disappearDefault: DisappearMode;
  reply: ReplyTarget | null;
  onCancelReply: () => void;
  proofFor: string | null;
  onClearProof: () => void;
  onSent?: () => void;
};

export function Composer({ ctx, disappearDefault, reply, onCancelReply, proofFor, onClearProof, onSent }: Props) {
  const s = useStrings();
  const pager = usePager();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<DisappearMode>(disappearDefault);
  const [recording, setRecording] = useState(false);
  const [willCancel, setWillCancel] = useState(false);
  const typing = useTypingBroadcast();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);

  useEffect(() => setMode(disappearDefault), [disappearDefault]);

  // ── voice recorder ──
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recState = useAudioRecorderState(recorder, 100);
  const samples = useRef<number[]>([]);
  const starting = useRef<Promise<boolean> | null>(null);
  useEffect(() => {
    if (recording && typeof recState.metering === 'number') samples.current.push(recState.metering);
  }, [recState.metering, recording]);

  const startRec = useCallback(() => {
    starting.current = (async () => {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(s.chat.voice, s.chat.micDenied);
        return false;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      samples.current = [];
      recorder.record();
      haptic.heavy();
      setRecording(true);
      return true;
    })().catch(() => false);
  }, [recorder, s]);

  const stopRec = useCallback(
    async (cancel: boolean) => {
      const ok = await (starting.current ?? Promise.resolve(false));
      starting.current = null;
      if (!ok) return;
      const durationMs = recorder.getStatus().durationMillis;
      await recorder.stop().catch(() => undefined);
      setRecording(false);
      setWillCancel(false);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
      const uri = recorder.uri;
      if (!uri) return;
      if (cancel || durationMs < 600 || !ctx) {
        haptic.warning();
        deleteTempFile(uri);
        return;
      }
      const id = await sendMedia(
        ctx,
        { uri, kind: 'voice', mime: 'audio/mp4', duration: durationMs / 1000, waveform: waveform(samples.current) },
        { replyTo: reply?.id ?? null, disappear: mode },
      );
      onCancelReply();
      if (id && proofFor) {
        await completeDare(proofFor, id);
        onClearProof();
      }
      onSent?.();
    },
    [recorder, ctx, reply, mode, proofFor, onCancelReply, onClearProof, onSent],
  );

  const drag = useSharedValue(0);
  const cancelArmed = useSharedValue(false);
  const micGesture = Gesture.Exclusive(
    Gesture.Pan()
      .activateAfterLongPress(140)
      .blocksExternalGesture(pager.gesture)
      .onStart(() => {
        cancelArmed.value = false;
        runOnJS(startRec)();
      })
      .onUpdate((e) => {
        const v = Math.max(0, e.translationX * CANCEL_DIR);
        drag.value = v * CANCEL_DIR;
        const armed = v > CANCEL_AT;
        if (armed !== cancelArmed.value) {
          cancelArmed.value = armed;
          runOnJS(setWillCancel)(armed);
          if (armed) runOnJS(haptic.warning)();
        }
      })
      .onFinalize((_e, success) => {
        drag.value = withSpring(0, springs.snappy);
        // always stop: an interrupted gesture discards the recording
        runOnJS(stopRec)(!success || cancelArmed.value);
      }),
    Gesture.Tap().onEnd(() => runOnJS(haptic.tap)()),
  );

  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: drag.value }] }));
  const dot = useSharedValue(1);
  useEffect(() => {
    dot.value = recording ? withRepeat(withTiming(0.2, { duration: 600 }), -1, true) : 1;
  }, [recording, dot]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: dot.value }));

  // ── text / media ──
  const send = async () => {
    if (!ctx || !text.trim()) return;
    const t = text;
    setText('');
    typing('');
    await sendText(ctx, t, { replyTo: reply?.id ?? null, disappear: mode });
    onCancelReply();
    onSent?.();
  };

  const attach = async () => {
    if (!ctx) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.7,
      videoMaxDuration: 120,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });
    if (r.canceled) return;
    for (const a of r.assets) {
      const isVideo = a.type === 'video';
      sendMedia(
        ctx,
        {
          uri: a.uri, kind: isVideo ? 'video' : 'image',
          mime: a.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
          width: a.width, height: a.height, duration: a.duration ? a.duration / 1000 : undefined,
        },
        { replyTo: reply?.id ?? null, disappear: mode },
      );
    }
    onCancelReply();
    onSent?.();
  };

  const hasText = text.trim().length > 0;

  return (
    <View style={styles.wrap}>
      {proofFor ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.banner}>
          <Ionicons name="mic" size={14} color={colors.coral} />
          <Txt variant="tiny" style={styles.flex}>{s.chat.cards.proofRecording}</Txt>
          <IconButton name="close" size={14} glass={false} label={s.common.cancel} onPress={onClearProof} style={styles.smallBtn} />
        </Animated.View>
      ) : null}
      {reply ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.banner}>
          <View style={styles.quoteBar} />
          <View style={styles.flex}>
            <Txt variant="tiny" color={colors.rose}>{`${s.chat.replyingTo} ${reply.author}`}</Txt>
            <Txt variant="small" muted numberOfLines={1}>{reply.text}</Txt>
          </View>
          <IconButton name="close" size={14} glass={false} label={s.common.cancel} onPress={onCancelReply} style={styles.smallBtn} />
        </Animated.View>
      ) : null}

      <View style={styles.row}>
        {recording ? (
          <View style={[styles.field, styles.recField]}>
            <Animated.View style={[styles.recDot, dotStyle]} />
            <Txt variant="small">{num(mmss(recState.durationMillis / 1000))}</Txt>
            <Animated.View style={[styles.flex, dragStyle]}>
              <Txt variant="small" color={willCancel ? colors.danger : colors.textMuted} center>
                {willCancel ? s.chat.releaseCancel : s.chat.slideCancel}
              </Txt>
            </Animated.View>
          </View>
        ) : (
          <>
            <IconButton name="add" label={s.chat.attach} onPress={attach} />
            <View style={styles.field}>
              <TextInput
                ref={input}
                value={text}
                onChangeText={(t) => {
                  setText(t);
                  typing(t);
                }}
                placeholder={s.chat.placeholder}
                placeholderTextColor={colors.textFaint}
                selectionColor={colors.rose}
                keyboardAppearance="dark"
                multiline
                style={styles.input}
                maxLength={4000}
                onKeyPress={
                  Platform.OS === 'web'
                    ? (e) => {
                        // web: Enter sends, Shift+Enter adds a new line
                        const ne = e.nativeEvent as unknown as { key: string; shiftKey?: boolean; isComposing?: boolean };
                        if (ne.key === 'Enter' && !ne.shiftKey && !ne.isComposing) {
                          (e as unknown as { preventDefault(): void }).preventDefault();
                          send();
                        }
                      }
                    : undefined
                }
              />
              <Pressy
                onPress={() => setMode(NEXT_MODE[mode])}
                hapticStyle="select"
                accessibilityLabel={s.chat.disappear[mode]}
                style={[styles.timer, mode !== 'off' && styles.timerOn]}
              >
                <Ionicons name={mode === 'off' ? 'timer-outline' : 'timer'} size={16} color={mode === 'off' ? colors.textFaint : colors.text} />
                {mode !== 'off' ? <Txt variant="tiny">{s.chat.disappearShort[mode]}</Txt> : null}
              </Pressy>
            </View>
          </>
        )}
        {hasText && !recording ? (
          <Pressy onPress={send} hapticStyle="none" accessibilityLabel={s.common.send} style={styles.sendBtn}>
            <Ionicons name="arrow-up" size={22} color={colors.text} />
          </Pressy>
        ) : (
          <GestureDetector gesture={micGesture}>
            <Animated.View accessibilityLabel={s.chat.recordHold} style={[styles.sendBtn, recording && styles.micActive]}>
              <Ionicons name="mic" size={22} color={colors.text} />
            </Animated.View>
          </GestureDetector>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xs, backgroundColor: 'rgba(11,7,9,0.92)' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  flex: { flex: 1 },
  field: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-end', minHeight: 42, borderRadius: radius.xl,
    backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingStart: space.md, paddingEnd: 4,
  },
  input: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 16, maxHeight: 120, paddingTop: 10, paddingBottom: 10, writingDirection: 'auto' },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 34, paddingHorizontal: 8, marginBottom: 4, borderRadius: radius.pill },
  timerOn: { backgroundColor: 'rgba(255,77,109,0.35)' },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  micActive: { transform: [{ scale: 1.25 }], backgroundColor: colors.red },
  recField: { alignItems: 'center', gap: space.sm, paddingEnd: space.md },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.md, backgroundColor: colors.surface },
  quoteBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.rose },
  smallBtn: { width: 28, height: 28 },
});
