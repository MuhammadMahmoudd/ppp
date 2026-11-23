import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Glass } from '@/components/Glass';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { ListRow, Divider } from '@/components/ListRow';
import { colors, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { api } from '@/lib/api';
import { COMMON_TIMEZONES, formatClock, isValidTimeZone } from '@/lib/time';
import { haptic } from '@/lib/haptics';
import { Chip } from '@/features/profile/ProfileForm';
import type { DisappearMode } from '@/lib/database.types';

export default function CoupleSettings() {
  const s = useStrings();
  const { couple, partner } = useSession();
  const [tz, setTz] = useState(couple?.home_timezone ?? 'Asia/Baghdad');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveTz = async () => {
    if (!isValidTimeZone(tz)) return setError(s.profile.timezone);
    setBusy(true);
    const { error: e } = await api.rpc('update_couple_settings', { p_home_timezone: tz });
    setBusy(false);
    if (e) setError(s.auth.errors.generic);
    else haptic.success();
  };
  const setMode = async (m: DisappearMode) => {
    await api.rpc('update_couple_settings', { p_chat_disappear_mode: m });
  };
  const modes: [DisappearMode, string][] = [['off', s.settings.disappearOff], ['view', s.settings.disappearView], ['24h', s.settings.disappear24h]];

  return (
    <Screen scroll header={<Header title={s.settings.couple} />}>
      <Glass style={styles.gap}>
        <Txt variant="heading">{s.settings.homeTimezone}</Txt>
        <Txt variant="small" muted>{s.settings.homeTimezoneBody}</Txt>
        <Input value={tz} onChangeText={setTz} autoCapitalize="none" autoCorrect={false} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {COMMON_TIMEZONES.map((z) => <Chip key={z} label={z.split('/')[1]?.replace('_', ' ') ?? z} active={z === tz} onPress={() => setTz(z)} />)}
        </ScrollView>
        {partner ? <Txt variant="small" muted>{fmt(s.profile.localTime, { time: formatClock(new Date(), partner.timezone) })} · {partner.timezone}</Txt> : null}
        {error ? <Txt color={colors.danger}>{error}</Txt> : null}
        <Button title={s.common.save} onPress={saveTz} loading={busy} small />
      </Glass>
      <Glass style={styles.gap}>
        <Txt variant="heading">{s.settings.disappearDefault}</Txt>
        <ScrollView horizontal contentContainerStyle={styles.chips}>
          {modes.map(([m, label]) => <Chip key={m} label={label} active={couple?.chat_disappear_mode === m} onPress={() => setMode(m)} />)}
        </ScrollView>
      </Glass>
      <Glass padded={false} style={styles.pad}>
        <ListRow
          icon="lock-closed-outline"
          title={s.settings.vaultProtection}
          toggle={{ value: !!couple?.vault_delete_protection, onChange: (v) => api.rpc('update_couple_settings', { p_vault_delete_protection: v }) }}
        />
        <Divider />
      </Glass>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  chips: { gap: space.sm },
  pad: { paddingHorizontal: space.lg },
});
