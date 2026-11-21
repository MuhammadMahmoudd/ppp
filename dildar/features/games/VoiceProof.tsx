/** Record a voice note as proof for a dare: encrypted upload → chat reply → complete_dare. */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { colors, space } from '@/lib/theme';
import { fmt, num, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { encryptAndUpload } from '@/lib/media';
import { postMessage } from '@/lib/messages';
import { haptic } from '@/lib/haptics';
import { completeDare } from './dares';

export function VoiceProof({ dareId, onDone }: { dareId: string; onDone: () => void }) {
  const s = useStrings();
  const { couple, userId, sharedKey } = useSession();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rs = useAudioRecorderState(recorder, 250);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) return setError(s.games.dares.micDenied);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    haptic.tap();
  };

  const stopAndSend = async () => {
    if (!couple || !userId || !sharedKey) return;
    setBusy(true);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri) throw new Error('no_recording');
      const media = await encryptAndUpload('chat-media', couple.id, uri, sharedKey);
      const duration = Math.round((rs.durationMillis ?? 0) / 1000);
      const msgId = await postMessage({
        coupleId: couple.id,
        senderId: userId,
        key: sharedKey,
        type: 'voice',
        body: { t: 'voice', duration },
        media,
        replyTo: dareId,
      });
      await completeDare(dareId, msgId);
      haptic.success();
      onDone();
    } catch {
      setError(s.states.errorBody);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.gap}>
      {rs.isRecording ? (
        <>
          <Txt center color={colors.rose}>{fmt(s.games.dares.recording, { s: num(Math.floor((rs.durationMillis ?? 0) / 1000)) })}</Txt>
          <Button title={s.games.dares.stopSend} onPress={stopAndSend} loading={busy} small />
        </>
      ) : (
        <Button title={s.games.dares.completeVoice} onPress={start} loading={busy} small variant="glass" />
      )}
      {error ? <Txt variant="small" color={colors.danger}>{error}</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({ gap: { gap: space.sm } });
