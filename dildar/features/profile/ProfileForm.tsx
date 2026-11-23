import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Txt } from '@/components/Txt';
import { Glass } from '@/components/Glass';
import { Avatar } from '@/components/Avatar';
import { Pressy } from '@/components/Pressy';
import { colors, radius, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { api } from '@/lib/api';
import { encryptAndUpload, cacheClear } from '@/lib/media';
import { COMMON_TIMEZONES, deviceTimeZone, isValidTimeZone } from '@/lib/time';
import { haptic } from '@/lib/haptics';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function ProfileForm({ onDone, submitLabel }: { onDone?: () => void; submitLabel?: string }) {
  const s = useStrings();
  const { me, couple, userId, sharedKey, refresh } = useSession();
  const [name, setName] = useState(me?.display_name ?? '');
  const [tz, setTz] = useState(me?.timezone && me.timezone !== 'Asia/Baghdad' ? me.timezone : deviceTimeZone());
  const [birthday, setBirthday] = useState(me?.birthday ?? '');
  const [anniversary, setAnniversary] = useState(couple?.anniversary ?? '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAvatar = async () => {
    if (!sharedKey || !couple || !userId) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (r.canceled || !r.assets[0]) return;
    setUploading(true);
    try {
      const up = await encryptAndUpload('avatars', couple.id, r.assets[0].uri, sharedKey);
      if (me?.avatar_path) api.storage.from('avatars').remove([me.avatar_path]).catch(() => undefined);
      await api.from('profiles').update({ avatar_path: up.path, avatar_nonce: up.nonce }).eq('user_id', userId);
      cacheClear();
      await refresh();
      haptic.success();
    } catch {
      setError(s.auth.errors.generic);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!userId) return;
    setError(null);
    if (!name.trim()) return setError(s.profile.name);
    if (!isValidTimeZone(tz)) return setError(s.profile.timezone);
    if (birthday && !DATE_RE.test(birthday)) return setError(s.profile.birthday);
    if (anniversary && !DATE_RE.test(anniversary)) return setError(s.profile.anniversary);
    setBusy(true);
    try {
      const { error: e } = await api
        .from('profiles')
        .update({ display_name: name.trim(), timezone: tz, birthday: birthday || null })
        .eq('user_id', userId);
      if (e) throw e;
      if (anniversary && anniversary !== couple?.anniversary) {
        await api.rpc('update_couple_settings', { p_anniversary: anniversary });
      }
      await refresh();
      haptic.success();
      onDone?.();
    } catch {
      setError(s.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.gap}>
      <View style={styles.center}>
        <Pressy onPress={pickAvatar} accessibilityLabel={s.profile.avatar}>
          <Avatar profile={me} size={104} ring />
        </Pressy>
        <Txt variant="small" muted>{uploading ? s.common.loading : s.profile.avatar}</Txt>
      </View>
      <Glass style={styles.gap}>
        <Input label={s.profile.name} value={name} onChangeText={setName} maxLength={60} />
        <Input label={s.profile.birthday} value={birthday} onChangeText={setBirthday} placeholder={s.profile.datePlaceholder} keyboardType="numbers-and-punctuation" />
        <Input label={s.profile.anniversary} value={anniversary} onChangeText={setAnniversary} placeholder={s.profile.datePlaceholder} keyboardType="numbers-and-punctuation" />
      </Glass>
      <Glass style={styles.gap}>
        <Txt variant="small" muted>{s.profile.timezone}</Txt>
        <Input value={tz} onChangeText={setTz} autoCapitalize="none" autoCorrect={false} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label={s.profile.detectTz} active={false} onPress={() => setTz(deviceTimeZone())} />
          {COMMON_TIMEZONES.map((z) => <Chip key={z} label={z.split('/')[1]?.replace('_', ' ') ?? z} active={z === tz} onPress={() => setTz(z)} />)}
        </ScrollView>
      </Glass>
      {error ? <Txt color={colors.danger} center>{error}</Txt> : null}
      <Button title={submitLabel ?? s.common.save} onPress={save} loading={busy} />
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressy onPress={onPress} hapticStyle="select" style={[styles.chip, active && styles.chipOn]}>
      <Txt variant="small" color={active ? colors.text : colors.textMuted}>{label}</Txt>
    </Pressy>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  center: { alignItems: 'center', gap: space.sm },
  chips: { gap: space.sm, paddingVertical: space.xs },
  chip: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
