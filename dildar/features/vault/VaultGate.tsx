/** Vault entry: Face ID re-check, then the separate vault PIN (if set). */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { colors, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';
import { authenticate } from '@/features/lock/lockStore';
import { hasVaultPin, verifyVaultPin } from './pin';
import { PinPad } from './PinPad';
import { installVaultAutoLock, useVaultUnlocked, vaultSession } from './vaultSession';

export function VaultGate({ children }: { children: React.ReactNode }) {
  const s = useStrings();
  const unlocked = useVaultUnlocked();
  const [step, setStep] = useState<'face' | 'pin'>('face');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => installVaultAutoLock(), []);

  const start = useCallback(async () => {
    setError(null);
    const ok = await authenticate(s.vault.unlock);
    if (!ok) {
      haptic.error();
      return;
    }
    if (await hasVaultPin()) setStep('pin');
    else {
      haptic.success();
      vaultSession.set({ unlocked: true });
    }
  }, [s.vault.unlock]);

  useEffect(() => {
    if (!unlocked) {
      setStep('face');
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  const checkPin = async (pin: string) => {
    setBusy(true);
    const r = await verifyVaultPin(pin);
    setBusy(false);
    if (r.ok) {
      haptic.success();
      vaultSession.set({ unlocked: true });
    } else {
      haptic.error();
      setError(r.wait > 0 ? fmt(s.vault.pin.tooMany, { n: r.wait }) : s.vault.pin.wrong);
    }
  };

  if (unlocked) return <>{children}</>;
  return (
    <View style={styles.root}>
      {step === 'pin' ? (
        <PinPad title={s.vault.pin.enter} error={error} onSubmit={checkPin} disabled={busy} />
      ) : (
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={56} color={colors.rose} />
          <Txt variant="title" center>{s.vault.locked}</Txt>
          <Txt muted center>{s.vault.subtitle}</Txt>
          <Button title={s.vault.unlock} onPress={start} icon={<Ionicons name="scan-outline" size={20} color={colors.text} />} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  center: { alignItems: 'center', gap: space.lg, padding: space.xl },
});
