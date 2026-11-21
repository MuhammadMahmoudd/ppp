/** The Camera page (home, center). Camera-first: the app opens here. */
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useChromeInsets } from '@/features/home/chrome';
import { usePager } from '@/features/home/Pager';
import { space } from '@/lib/theme';
import { SnapStudio } from './SnapStudio';
import { IncomingSnaps } from './IncomingSnaps';
import { SendingPill } from './SendingPill';

export function CameraScreen({ active }: { active: boolean }) {
  const { top, bottom } = useChromeInsets();
  const { setSwipeEnabled } = usePager();
  const onEditingChange = useCallback((editing: boolean) => setSwipeEnabled(!editing), [setSwipeEnabled]);
  return (
    <View style={styles.root}>
      <SnapStudio
        active={active}
        topInset={top}
        bottomInset={bottom}
        onEditingChange={onEditingChange}
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
