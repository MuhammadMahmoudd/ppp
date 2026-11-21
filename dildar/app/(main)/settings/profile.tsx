import React from 'react';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { useStrings } from '@/lib/i18n';
import { ProfileForm } from '@/features/profile/ProfileForm';

export default function ProfileSettings() {
  const s = useStrings();
  return (
    <Screen scroll header={<Header title={s.profile.title} />}>
      <ProfileForm onDone={() => router.back()} />
    </Screen>
  );
}
