/**
 * Wrapper for every spicy screen:
 *  • locked explanation unless BOTH partners turned Spicy Mode on
 *  • Face ID re-check (always on the hub, reused 10 min on sub-screens)
 *  • screenshot detection + screen-recording block (useScreenGuard)
 */
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OfflineBanner } from '@/components/States';
import { Header } from '@/components/Header';
import { Glass } from '@/components/Glass';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { colors, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useScreenGuard } from '@/features/security/useScreenGuard';
import { unlockSpicy, useSpicyUnlocked, spicyAuthStore } from './gate';

type Props = {
  title: string;
  children: React.ReactNode;
  scroll?: boolean;
  right?: React.ReactNode;
  /** hub: always ask for Face ID on mount */
  freshAuth?: boolean;
};

export const SPICY_BG = ['#2A0710', '#12060A', '#0B0709'] as const;

export function SpicyScreen({ title, children, scroll = true, right, freshAuth }: Props) {
  const s = useStrings();
  const { spicyActive } = useSession();
  const unlocked = useSpicyUnlocked();
  useScreenGuard('spicy', undefined, spicyActive);

  useEffect(() => {
    if (!spicyActive) return;
    if (freshAuth) spicyAuthStore.set({ at: 0 });
    if (freshAuth || !unlocked) unlockSpicy(s.spicy.authBody);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spicyActive, freshAuth]);

  let body: React.ReactNode = children;
  if (!spicyActive) body = <SpicyLocked />;
  else if (!unlocked) body = <SpicyAuthPrompt />;

  return (
    <View style={styles.root}>
      <LinearGradient colors={SPICY_BG} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['top', 'bottom']} style={styles.flex}>
        <Header title={title} right={spicyActive && unlocked ? right : undefined} />
        <OfflineBanner />
        {scroll && spicyActive && unlocked ? (
          <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            {body}
          </ScrollView>
        ) : (
          <View style={styles.flex}>{body}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

function SpicyAuthPrompt() {
  const s = useStrings();
  return (
    <View style={styles.center}>
      <Ionicons name="finger-print" size={52} color={colors.rose} />
      <Txt variant="title" center>{s.spicy.authTitle}</Txt>
      <Txt muted center>{s.spicy.authBody}</Txt>
      <Button title={s.spicy.authButton} onPress={() => unlockSpicy(s.spicy.authBody)} style={styles.wide} />
    </View>
  );
}

function SpicyLocked() {
  const s = useStrings();
  const { couple, role } = useSession();
  const mine = couple ? (role === 'a' ? couple.spicy_enabled_a : couple.spicy_enabled_b) : false;
  const theirs = couple ? (role === 'a' ? couple.spicy_enabled_b : couple.spicy_enabled_a) : false;
  const Row = ({ label, on }: { label: string; on: boolean }) => (
    <View style={styles.row}>
      <Ionicons name={on ? 'flame' : 'flame-outline'} size={20} color={on ? colors.coral : colors.textFaint} />
      <Txt style={styles.flex}>{label}</Txt>
      <Txt variant="small" color={on ? colors.success : colors.textMuted}>{on ? s.spicy.enabled : s.spicy.notEnabled}</Txt>
    </View>
  );
  return (
    <Animated.View entering={FadeIn} style={styles.center}>
      <Txt style={styles.emoji}>🔒</Txt>
      <Txt variant="title" center>{s.spicy.lockedTitle}</Txt>
      <Txt muted center>{s.spicy.lockedBody}</Txt>
      <Glass style={styles.status}>
        <Row label={s.spicy.you} on={mine} />
        <Row label={s.spicy.partner} on={theirs} />
      </Glass>
      <Button title={s.spicy.openSettings} variant="glass" onPress={() => router.push('/settings')} style={styles.wide} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  emoji: { fontSize: 56, lineHeight: 72 },
  status: { alignSelf: 'stretch', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  wide: { alignSelf: 'stretch' },
});
