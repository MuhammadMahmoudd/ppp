import React from 'react';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { useStrings } from '@/lib/i18n';
import { PinSettings } from '@/features/vault/PinSettings';
import { useScreenGuard } from '@/features/security/useScreenGuard';

export default function VaultPinRoute() {
  const s = useStrings();
  useScreenGuard('vault');
  return (
    <Screen header={<Header title={s.vault.pin.title} />}>
      <PinSettings />
    </Screen>
  );
}
