import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Pressy } from '@/components/Pressy';
import { Txt } from '@/components/Txt';
import { colors, radius, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { dismissJob, useSendJobs } from './sendSnap';

/** Optimistic send state: sending → sent ✓ / failed (tap to retry). */
export function SendingPill() {
  const s = useStrings();
  const jobs = useSendJobs();
  if (!jobs.length) return null;
  const failed = jobs.find((j) => j.status === 'failed');
  const sending = jobs.some((j) => j.status === 'sending');
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.wrap}>
      {failed ? (
        <Pressy onPress={failed.retry} onLongPress={() => dismissJob(failed.id)} style={[styles.pill, styles.failed]}>
          <Ionicons name="refresh" size={16} color={colors.text} />
          <Txt variant="small">{s.snaps.sendFailed}</Txt>
        </Pressy>
      ) : (
        <View style={styles.pill}>
          {sending ? <ActivityIndicator size="small" color={colors.text} /> : <Ionicons name="checkmark-circle" size={16} color={colors.success} />}
          <Txt variant="small">{sending ? s.snaps.sending : s.snaps.sent}</Txt>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(20,13,16,0.75)' },
  failed: { backgroundColor: 'rgba(255,90,95,0.8)' },
});
