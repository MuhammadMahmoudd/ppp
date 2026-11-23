import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Glass } from '@/components/Glass';
import { ListRow, Divider } from '@/components/ListRow';
import { Txt } from '@/components/Txt';
import { Avatar } from '@/components/Avatar';
import { colors, space } from '@/lib/theme';
import { fmt, setLocale, useStrings } from '@/lib/i18n';
import { updateSettings, useSettings } from '@/lib/settings';
import { useSession } from '@/lib/session';
import { api } from '@/lib/api';
import { coupleLevel } from '@/lib/streak';
import { haptic } from '@/lib/haptics';
import { authenticate } from '@/features/lock/lockStore';

export default function Settings() {
  const s = useStrings();
  const st = useSettings();
  const { me, partner, couple, role, signOut } = useSession();
  const mineOn = couple ? (role === 'a' ? couple.spicy_enabled_a : couple.spicy_enabled_b) : false;
  const theirsOn = couple ? (role === 'a' ? couple.spicy_enabled_b : couple.spicy_enabled_a) : false;
  const level = coupleLevel(couple?.couple_xp ?? 0);

  const toggleSpicy = async (v: boolean) => {
    if (v && !(await authenticate())) return;
    const { error } = await api.rpc('set_spicy', { enabled: v });
    if (!error) haptic.success();
  };

  const chooseLanguage = () =>
    Alert.alert(s.settings.language, s.settings.languageRestart, [
      { text: s.settings.languageKurdish, onPress: () => setLocale('ckb') },
      { text: s.settings.languageEnglish, onPress: () => setLocale('en') },
      { text: s.common.cancel, style: 'cancel' },
    ]);

  return (
    <Screen scroll header={<Header title={s.settings.title} />}>
      <Glass style={styles.couple}>
        <View style={styles.avatars}>
          <Avatar profile={me} size={56} ring />
          <Txt style={styles.heart}>❤️</Txt>
          <Avatar profile={partner} size={56} ring />
        </View>
        <Txt variant="heading" center>{`${me?.display_name ?? ''} & ${partner?.display_name ?? ''}`}</Txt>
        <Txt muted center variant="small">{fmt(s.settings.coupleLevel, { n: level.level })}</Txt>
        <View style={styles.bar}><View style={[styles.fill, { width: `${Math.round(level.progress * 100)}%` }]} /></View>
      </Glass>

      <Glass padded={false} style={styles.section}>
        <ListRow icon="person-circle-outline" title={s.profile.title} onPress={() => router.push('/settings/profile')} />
        <Divider />
        <ListRow icon="home-outline" title={s.settings.couple} subtitle={couple?.home_timezone} onPress={() => router.push('/settings/couple')} />
        <Divider />
        <ListRow icon="shield-checkmark-outline" title={s.settings.security} onPress={() => router.push('/settings/security')} />
      </Glass>

      <Glass padded={false} style={styles.section}>
        <ListRow icon="flame-outline" title={s.settings.spicy} subtitle={s.settings.spicyBody} toggle={{ value: mineOn, onChange: toggleSpicy }} />
        <Txt variant="small" muted>{fmt(s.settings.spicyYou, { state: mineOn ? s.common.on : s.common.off })}  ·  {fmt(s.settings.spicyPartner, { state: theirsOn ? s.common.on : s.common.off })}</Txt>
        <Txt variant="small" color={mineOn && theirsOn ? colors.coral : colors.textFaint}>{mineOn && theirsOn ? s.settings.spicyActive : s.settings.spicyWaiting}</Txt>
        <View style={{ height: space.md }} />
      </Glass>

      <Glass padded={false} style={styles.section}>
        <ListRow icon="language-outline" title={s.settings.language} value={st.locale === 'ckb' ? s.settings.languageKurdish : s.settings.languageEnglish} onPress={chooseLanguage} />
        <Divider />
        <ListRow icon="calculator-outline" title={s.settings.numerals} toggle={{ value: st.kurdishNumerals, onChange: (v) => updateSettings({ kurdishNumerals: v }) }} />
        <Divider />
        <ListRow icon="pulse-outline" title={s.settings.haptics} toggle={{ value: st.haptics, onChange: (v) => updateSettings({ haptics: v }) }} />
        <Divider />
        <ListRow icon="leaf-outline" title={s.settings.reduceMotion} toggle={{ value: st.reduceMotion, onChange: (v) => updateSettings({ reduceMotion: v }) }} />
      </Glass>

      <Glass padded={false} style={styles.section}>
        <ListRow icon="log-out-outline" title={s.auth.signOut} danger onPress={signOut} />
      </Glass>
      <Txt variant="tiny" muted center>{fmt(s.settings.version, { v: Constants.expoConfig?.version ?? '1.0.0' })}</Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  couple: { alignItems: 'center', gap: space.sm },
  avatars: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heart: { fontSize: 22 },
  bar: { height: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: colors.surfaceStrong, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.accent },
  section: { paddingHorizontal: space.lg },
});
