import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressy } from '@/components/Pressy';
import { Txt } from '@/components/Txt';
import { colors, radius, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';

/** Gentle monthly reminder to refresh the Yes/No/Maybe answers. */
export function CheckinBanner() {
  const s = useStrings();
  return (
    <Pressy onPress={() => router.push('/spicy/checkin')} scaleTo={0.98}>
      <View style={styles.banner}>
        <Ionicons name="moon-outline" size={22} color={colors.warning} />
        <View style={styles.flex}>
          <Txt variant="heading">{s.spicy.checkin.bannerTitle}</Txt>
          <Txt variant="small" muted>{s.spicy.checkin.bannerBody}</Txt>
        </View>
      </View>
    </Pressy>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: 'rgba(255,200,97,0.10)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,200,97,0.4)' },
  flex: { flex: 1 },
});
