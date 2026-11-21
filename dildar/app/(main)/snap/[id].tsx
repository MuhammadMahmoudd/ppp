import React from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SnapViewer } from '@/features/snaps/SnapViewer';

export default function SnapRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
      <SnapViewer key={id} id={String(id)} />
    </>
  );
}
