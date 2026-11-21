/** Record a voice note straight into the vault (never saved elsewhere). */
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { Glass } from '@/components/Glass';
import { Txt } from '@/components/Txt';
import { colors, space } from '@/lib/theme';
import { fmt, num, useStrings } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';
import { deleteTempFile } from '@/lib/media';

export function VoiceRecorder({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: (uri: string, durationMs: number) => void }) {
  const s = useStrings();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [denied, setDenied] = useState(false);
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = state.isRecording ? withRepeat(withTiming(1.25, { duration: 600 }), -1, true) : withTiming(1);
  }, [state.isRecording, pulse]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const start = async () => {
    const p = await requestRecordingPermissionsAsync();
    if (!p.granted) {
      setDenied(true);
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    haptic.heavy();
  };
  const stop = async (keep: boolean) => {
    const dur = state.durationMillis;
    if (state.isRecording) await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const uri = recorder.uri;
    if (keep && uri && dur > 500) {
      haptic.success();
      onDone(uri, dur);
    } else {
      if (uri) deleteTempFile(uri);
      onClose();
    }
  };
  const secs = Math.floor(state.durationMillis / 1000);
  const time = `${num(Math.floor(secs / 60))}:${num(String(secs % 60).padStart(2, '0'))}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => stop(false)}>
      <View style={styles.backdrop}>
        <Glass style={styles.card}>
          <Txt variant="heading" center>{s.vault.voiceNote}</Txt>
          <Animated.View style={[styles.mic, state.isRecording && styles.micOn, a]}>
            <Ionicons name="mic" size={40} color={colors.text} />
          </Animated.View>
          <Txt center muted>{state.isRecording ? fmt(s.vault.recording, { time }) : denied ? s.vault.micDenied : ' '}</Txt>
          {state.isRecording ? (
            <Button title={s.vault.stop} onPress={() => stop(true)} icon={<Ionicons name="stop" size={18} color={colors.text} />} />
          ) : (
            <Button title={s.vault.record} onPress={start} disabled={denied} icon={<Ionicons name="radio-button-on" size={18} color={colors.text} />} />
          )}
          <Button title={s.common.cancel} variant="ghost" small onPress={() => stop(false)} />
        </Glass>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: space.xl },
  card: { gap: space.lg, alignItems: 'stretch' },
  mic: { alignSelf: 'center', width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' },
  micOn: { backgroundColor: colors.accent },
});
