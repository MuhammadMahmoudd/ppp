import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Txt } from '@/components/Txt';
import { Glass } from '@/components/Glass';
import { space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';

/** Shown when EXPO_PUBLIC_SUPABASE_* are missing (see SETUP.md). */
export function NotConfigured() {
  const s = useStrings();
  return (
    <Screen>
      <View style={styles.center}>
        <Txt style={styles.emoji}>🛠️</Txt>
        <Txt variant="title" center>{s.appName}</Txt>
        <Glass><Txt center>{s.auth.errors.notConfigured}</Txt></Glass>
        <Txt muted center variant="small">EXPO_PUBLIC_SUPABASE_URL · EXPO_PUBLIC_SUPABASE_ANON_KEY</Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.lg },
  emoji: { fontSize: 56, lineHeight: 72, textAlign: 'center' },
});
