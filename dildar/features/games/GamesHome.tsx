import React from 'react';
import { View } from 'react-native';
import { EmptyState } from '@/components/States';
import { useChromeInsets } from '@/features/home/chrome';

/** Placeholder — implemented in its feature phase. */
export function GamesHome({ active }: { active: boolean }) {
  const { top, bottom } = useChromeInsets();
  void active;
  return (
    <View style={{ flex: 1, paddingTop: top, paddingBottom: bottom }}>
      <EmptyState emoji="🎲" />
    </View>
  );
}
