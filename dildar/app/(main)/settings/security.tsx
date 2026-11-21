import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Glass } from '@/components/Glass';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { ListRow, Divider } from '@/components/ListRow';
import { colors, space } from '@/lib/theme';
import { num, useStrings } from '@/lib/i18n';
import { updateSettings, useSettings } from '@/lib/settings';
import { useSession } from '@/lib/session';
import { safetyCode } from '@/lib/crypto';
import { uploadBackup } from '@/lib/keys';
import { setPushPreviews } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { authenticate } from '@/features/lock/lockStore';

export default function SecuritySettings() {
  const s = useStrings();
  const st = useSettings();
  const { me, partner, keyPair, userId } = useSession();
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [previews, setPreviews] = useState(false);

  React.useEffect(() => {
    if (!userId) return;
    supabase.from('devices').select('push_previews').eq('user_id', userId).maybeSingle().then(({ data }) => setPreviews(!!data?.push_previews));
  }, [userId]);

  const backup = async () => {
    if (!keyPair || !userId) return;
    if (pass.length < 8) return setMsg(s.auth.errors.weakPassword);
    if (pass !== pass2) return setMsg(s.keys.mismatch);
    if (!(await authenticate())) return;
    setBusy(true);
    setMsg(s.keys.working);
    try {
      await uploadBackup(userId, keyPair, pass);
      setMsg(s.keys.backupDone);
      setPass('');
      setPass2('');
      haptic.success();
    } catch {
      setMsg(s.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  const code = me?.public_key && partner?.public_key ? safetyCode(me.public_key, partner.public_key) : null;

  return (
    <Screen scroll header={<Header title={s.settings.security} />}>
      <Glass padded={false} style={styles.pad}>
        <ListRow icon="scan-outline" title={s.settings.faceId} toggle={{ value: st.faceIdOnOpen, onChange: async (v) => { if (await authenticate()) updateSettings({ faceIdOnOpen: v }); } }} />
        <Divider />
        <ListRow icon="timer-outline" title={s.settings.autoLock} toggle={{ value: st.autoLock, onChange: (v) => updateSettings({ autoLock: v }), disabled: !st.faceIdOnOpen }} />
        <Divider />
        <ListRow icon="phone-portrait-outline" title={s.settings.quickHide} subtitle={s.settings.quickHideBody} toggle={{ value: st.quickHideShake, onChange: (v) => updateSettings({ quickHideShake: v }) }} />
        <Divider />
        <ListRow icon="keypad-outline" title={s.settings.vaultPin} onPress={() => router.push('/vault/pin')} />
        <Divider />
        <ListRow
          icon="notifications-outline"
          title={s.settings.notificationPreviews}
          subtitle={s.settings.notificationPreviewsBody}
          toggle={{ value: previews, onChange: (v) => { setPreviews(v); if (userId) setPushPreviews(userId, v); } }}
        />
      </Glass>

      {code ? (
        <Glass style={styles.gap}>
          <Txt variant="heading">{s.keys.safetyCode}</Txt>
          <Txt variant="small" muted>{s.keys.safetyCodeBody}</Txt>
          <View style={styles.code}><Txt variant="heading" center style={styles.mono}>{num(code)}</Txt></View>
        </Glass>
      ) : null}

      <Glass style={styles.gap}>
        <Txt variant="heading">{s.keys.backupTitle}</Txt>
        <Txt variant="small" muted>{s.keys.backupBody}</Txt>
        <Txt variant="small" color={colors.warning}>{s.keys.backupWarning}</Txt>
        <Input label={s.keys.passphrase} value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" />
        <Input label={s.keys.passphraseRepeat} value={pass2} onChangeText={setPass2} secureTextEntry autoCapitalize="none" />
        {msg ? <Txt variant="small" muted>{msg}</Txt> : null}
        <Button title={s.keys.createBackup} onPress={backup} loading={busy} small />
      </Glass>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.lg },
  gap: { gap: space.md },
  code: { backgroundColor: colors.surfaceStrong, borderRadius: 12, padding: space.md },
  mono: { letterSpacing: 2, direction: 'ltr' },
});
