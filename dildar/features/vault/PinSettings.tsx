/** Set / change / remove the vault PIN (Settings › Security › Vault PIN). */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { colors, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';
import { authenticate } from '@/features/lock/lockStore';
import { hasVaultPin, removeVaultPin, setVaultPin, verifyVaultPin } from './pin';
import { isValidPin } from './pinHash';
import { PinPad } from './PinPad';

type Step = 'loading' | 'overview' | 'current' | 'new' | 'repeat' | 'saving' | 'done';

export function PinSettings() {
  const s = useStrings();
  const [has, setHas] = useState(false);
  const [step, setStep] = useState<Step>('loading');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<'change' | 'remove'>('change');

  useEffect(() => {
    hasVaultPin().then((h) => {
      setHas(h);
      setStep('overview');
    });
  }, []);

  const begin = async (what: 'change' | 'remove') => {
    if (!(await authenticate())) return;
    setIntent(what);
    setError(null);
    setStep(has ? 'current' : 'new');
  };

  const onCurrent = async (pin: string) => {
    const r = await verifyVaultPin(pin);
    if (!r.ok) {
      haptic.error();
      return setError(r.wait > 0 ? fmt(s.vault.pin.tooMany, { n: r.wait }) : s.vault.pin.wrong);
    }
    setError(null);
    if (intent === 'remove') {
      await removeVaultPin();
      haptic.success();
      setHas(false);
      setStep('done');
      return;
    }
    setStep('new');
  };
  const onNew = (pin: string) => {
    if (!isValidPin(pin)) return setError(s.vault.pin.tooShort);
    setError(null);
    setFirst(pin);
    setStep('repeat');
  };
  const onRepeat = async (pin: string) => {
    if (pin !== first) {
      haptic.error();
      setFirst('');
      setStep('new');
      return setError(s.vault.pin.mismatch);
    }
    setStep('saving');
    await setVaultPin(pin);
    haptic.success();
    setHas(true);
    setStep('done');
  };

  if (step === 'current') return <PinPad title={s.vault.pin.current} error={error} onSubmit={onCurrent} />;
  if (step === 'new') return <PinPad title={s.vault.pin.enterNew} subtitle={s.vault.pin.body} error={error} onSubmit={onNew} />;
  if (step === 'repeat') return <PinPad title={s.vault.pin.repeat} error={error} onSubmit={onRepeat} autoSubmitAt={first.length} />;

  return (
    <View style={styles.root}>
      <Txt style={styles.emoji}>🔐</Txt>
      <Txt variant="title" center>{s.vault.pin.title}</Txt>
      <Txt muted center>{s.vault.pin.body}</Txt>
      <Txt center color={has ? colors.success : colors.textMuted}>{step === 'loading' ? s.common.loading : has ? s.vault.pin.isSet : s.vault.pin.notSet}</Txt>
      {step === 'done' && <Txt center color={colors.success}>{has ? s.vault.pin.saved : s.vault.pin.removed}</Txt>}
      <View style={styles.actions}>
        <Button title={has ? s.vault.pin.change : s.vault.pin.set} onPress={() => begin('change')} loading={step === 'saving'} disabled={step === 'loading'} />
        {has && <Button title={s.vault.pin.remove} variant="danger" onPress={() => begin('remove')} />}
        {step === 'done' && <Button title={s.common.done} variant="ghost" small onPress={() => router.back()} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.md },
  emoji: { fontSize: 56, lineHeight: 72, textAlign: 'center' },
  actions: { gap: space.md, marginTop: space.lg },
});
