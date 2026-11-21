import React from 'react';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { EmptyState } from '@/components/States';

/** Placeholder — implemented in its feature phase. */
export default function Placeholder() {
  return (
    <Screen header={<Header title="" />}>
      <EmptyState />
    </Screen>
  );
}
