import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { VaultGate } from '@/features/vault/VaultGate';
import { VaultItemViewer } from '@/features/vault/VaultItemViewer';

export default function VaultItemRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VaultGate>
      <VaultItemViewer id={String(id)} />
    </VaultGate>
  );
}
