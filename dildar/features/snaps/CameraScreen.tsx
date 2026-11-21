/** The Camera page (home, center). Camera-first: the app opens here. */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useChromeInsets } from '@/features/home/chrome';
import { usePager } from '@/features/home/Pager';
import { space } from '@/lib/theme';
import { SnapStudio } from './SnapStudio';
import { IncomingSnaps } from './IncomingSnaps';
import { SendingPill } from './SendingPill';

export function CameraScreen({ active }: { active: boolean }) {
  const { top, bottom } = useChromeInsets();
  const { setSwipeEnabled, gesture } = usePager();
  const [editing, setEditing] = useState(false);
  const [recording, setRecording] = useState(false);
  // no page swiping while editing a snap or recording a video
  useEffect(() => setSwipeEnabled(!editing && !recording), [editing, recording, setSwipeEnabled]);
  return (
    <View style={styles.root}>
      <SnapStudio
        active={active}
        topInset={top}
        bottomInset={bottom}
        onEditingChange={setEditing}
        onRecordingChange={setRecording}
        blockGesture={gesture}
        accessory={
          <View style={styles.accessory}>
            <SendingPill />
            <IncomingSnaps />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  accessory: { gap: space.sm, alignItems: 'center', marginBottom: space.sm },
});
