import React from 'react';
import { VaultGate } from '@/features/vault/VaultGate';
import { VaultHome } from '@/features/vault/VaultHome';

/** Vault: Face ID + optional PIN, then the encrypted grid. */
export default function VaultRoute() {
  return (
    <VaultGate>
      <VaultHome />
    </VaultGate>
  );
}
