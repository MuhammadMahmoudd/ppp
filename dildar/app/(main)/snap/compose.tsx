/**
 * Full-screen camera + editor as a modal.
 * /snap/compose?proofFor=<dare message id> sends the snap as dare proof
 * (marks the dare done via complete_dare) and closes.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { colors, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { SnapStudio } from '@/features/snaps/SnapStudio';
import { SendingPill } from '@/features/snaps/SendingPill';

export default function Compose() {
  const s = useStrings();
  const insets = useSafeAreaInsets();
  const { proofFor } = useLocalSearchParams<{ proofFor?: string }>();
  const [status, setStatus] = useState<'idle' | 'sending' | 'failed' | 'done'>('idle');
  const [editing, setEditing] = useState(false);
  const isProof = typeof proofFor === 'string' && proofFor.length > 0;

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: !editing }} />
      <SnapStudio
        active={status !== 'done'}
        topInset={insets.top + 56}
        bottomInset={insets.bottom + space.lg}
        onEditingChange={setEditing}
        proofFor={isProof ? proofFor : null}
        editorTitle={isProof ? s.snaps.proofTitle : undefined}
        accessory={<SendingPill />}
        onSent={(id) => {
          if (isProof) {
            setStatus(id ? 'done' : 'failed');
            if (id) setTimeout(() => router.back(), 900);
          } else if (id) router.back();
        }}
      />
      {!editing && (
        <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
          <IconButton name="close" label={s.common.close} onPress={() => router.back()} />
          {isProof && <Txt variant="heading">{s.snaps.proofTitle}</Txt>}
          <View style={{ width: 42 }} />
        </View>
      )}
      {status === 'done' && (
        <Animated.View entering={FadeIn} style={styles.done}>
          <Txt variant="title" center>{s.snaps.proofSent}</Txt>
        </Animated.View>
      )}
      {status === 'failed' && (
        <View style={styles.done}><Txt center color={colors.danger}>{s.snaps.sendFailed}</Txt></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', top: 0, start: 0, end: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg },
  done: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,7,9,0.8)' },
});
