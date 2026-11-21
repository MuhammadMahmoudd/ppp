/**
 * Step 1 after sign-in: make sure this device has an E2E keypair.
 *  • backup exists on server → restore with passphrase (or start fresh)
 *  • otherwise → generate a key, then offer a passphrase backup
 */
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Txt } from '@/components/Txt';
import { Glass } from '@/components/Glass';
import { Skeleton } from '@/components/States';
import { colors, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { createAndPublishKeyPair, hasRemoteBackup, restoreFromBackup, uploadBackup } from '@/lib/keys';
import type { KeyPairB64 } from '@/lib/crypto';
import { haptic } from '@/lib/haptics';

type Mode = 'checking' | 'restore' | 'backup';

export default function KeysSetup() {
  const s = useStrings();
  const { userId, setKeyPair, refresh } = useSession();
  const [mode, setMode] = useState<Mode>('checking');
  const [pending, setPending] = useState<KeyPairB64 | null>(null);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    hasRemoteBackup(userId).then(async (has) => {
      if (has) setMode('restore');
      else {
        setPending(await createAndPublishKeyPair(userId));
        setMode('backup');
      }
    });
  }, [userId]);

  const finish = async (kp: KeyPairB64) => {
    setKeyPair(kp);
    await refresh();
  };

  const doRestore = async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const kp = await restoreFromBackup(userId, pass);
      haptic.success();
      await finish(kp);
    } catch {
      haptic.error();
      setError(s.keys.wrongPassphrase);
    } finally {
      setBusy(false);
    }
  };

  const startFresh = () => {
    Alert.alert(s.keys.startFresh, s.keys.startFreshConfirm, [
      { text: s.common.cancel, style: 'cancel' },
      {
        text: s.common.confirm,
        style: 'destructive',
        onPress: async () => {
          if (!userId) return;
          setPending(await createAndPublishKeyPair(userId));
          setPass('');
          setMode('backup');
        },
      },
    ]);
  };

  const doBackup = async () => {
    if (!userId || !pending) return;
    if (pass.length < 8) return setError(s.auth.errors.weakPassword);
    if (pass !== pass2) return setError(s.keys.mismatch);
    setBusy(true);
    setError(null);
    try {
      await uploadBackup(userId, pending, pass);
      haptic.success();
      await finish(pending);
    } catch {
      setError(s.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Ionicons name="lock-closed" size={44} color={colors.rose} />
        <Txt variant="title" center>{mode === 'restore' ? s.keys.restoreTitle : s.keys.title}</Txt>
        <Txt muted center>{mode === 'restore' ? s.keys.restoreBody : s.keys.body}</Txt>
      </View>

      {mode === 'checking' && (
        <Glass style={styles.gap}>
          <Txt muted center>{s.keys.creating}</Txt>
          <Skeleton height={54} />
        </Glass>
      )}

      {mode === 'restore' && (
        <Glass style={styles.gap}>
          <Input label={s.keys.passphrase} value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" onSubmitEditing={doRestore} />
          {error ? <Txt color={colors.danger}>{error}</Txt> : null}
          {busy ? <Txt muted center>{s.keys.working}</Txt> : null}
          <Button title={s.keys.restore} onPress={doRestore} loading={busy} />
          <Button title={s.keys.startFresh} onPress={startFresh} variant="ghost" small />
        </Glass>
      )}

      {mode === 'backup' && (
        <Glass style={styles.gap}>
          <Txt variant="heading">{s.keys.backupTitle}</Txt>
          <Txt muted>{s.keys.backupBody}</Txt>
          <View style={styles.warning}><Txt variant="small" color={colors.warning}>{s.keys.backupWarning}</Txt></View>
          <Input label={s.keys.passphrase} value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" />
          <Input label={s.keys.passphraseRepeat} value={pass2} onChangeText={setPass2} secureTextEntry autoCapitalize="none" onSubmitEditing={doBackup} />
          {error ? <Txt color={colors.danger}>{error}</Txt> : null}
          {busy ? <Txt muted center>{s.keys.working}</Txt> : null}
          <Button title={s.keys.createBackup} onPress={doBackup} loading={busy} />
          <Button title={s.keys.skipBackup} onPress={() => pending && finish(pending)} variant="ghost" small />
        </Glass>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, paddingTop: space.xxl },
  gap: { gap: space.md },
  warning: { backgroundColor: 'rgba(255,200,97,0.1)', borderRadius: 12, padding: space.md },
});
