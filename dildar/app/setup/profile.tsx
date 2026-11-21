import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { ProfileForm } from '@/features/profile/ProfileForm';

export default function ProfileSetup() {
  const s = useStrings();
  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Txt variant="title" center>{s.profile.setupTitle}</Txt>
        <Txt muted center>{s.pairing.paired}</Txt>
      </View>
      <ProfileForm submitLabel={s.common.done} />
    </Screen>
  );
}

const styles = StyleSheet.create({ hero: { alignItems: 'center', gap: space.sm, paddingTop: space.lg } });
