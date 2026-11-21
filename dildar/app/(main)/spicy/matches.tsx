/** Only overlaps (yes+yes, yes+maybe) — computed server-side by ynm_matches(). */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Glass } from '@/components/Glass';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { colors, radius, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { useSettings, useReducedMotion } from '@/lib/settings';
import { useSession } from '@/lib/session';
import { haptic } from '@/lib/haptics';
import { SpicyScreen } from '@/features/spicy/SpicyScreen';
import { useSpicyUnlocked } from '@/features/spicy/gate';
import { useAsync } from '@/features/spicy/useAsync';
import { itemLabel } from '@/features/spicy/labels';
import { addTrySoon, loadCustomItems, loadMatches, loadTrySoon, markTrySoonDone, removeTrySoon } from '@/features/spicy/api';

export default function Matches() {
  const s = useStrings();
  const { locale } = useSettings();
  const reduce = useReducedMotion();
  const { userId, couple, sharedKey, spicyActive } = useSession();
  const unlocked = useSpicyUnlocked();
  const enabled = spicyActive && unlocked && !!userId;
  const data = useAsync(
    async () => {
      const [matches, trySoon, custom] = await Promise.all([loadMatches(), loadTrySoon(), loadCustomItems(userId as string, sharedKey)]);
      return { matches, trySoon, custom };
    },
    [userId, sharedKey],
    enabled,
  );

  const act = async (fn: () => Promise<void>) => {
    try {
      await fn();
      haptic.success();
      await data.reload();
    } catch {
      haptic.error();
    }
  };

  if (data.error) {
    return <SpicyScreen title={s.spicy.matches.title}><ErrorState onRetry={data.reload} /></SpicyScreen>;
  }
  const d = data.data;
  const inList = new Set((d?.trySoon ?? []).map((t) => t.item_key));
  const label = (key: string) => itemLabel(key, locale, d?.custom ?? []) ?? '…';

  return (
    <SpicyScreen title={s.spicy.matches.title}>
      <Txt muted>{s.spicy.matches.intro}</Txt>
      {!d ? (
        <View style={styles.gap}>{[0, 1, 2].map((i) => <Skeleton key={i} height={72} />)}</View>
      ) : d.matches.length === 0 ? (
        <EmptyState emoji="💞" title={s.spicy.matches.empty} action={{ label: s.spicy.tools.ynm, onPress: () => router.push('/spicy/ynm') }} />
      ) : (
        d.matches.map((m, i) => (
          <Animated.View key={m.key} entering={reduce ? undefined : FadeInDown.delay(i * 40).springify()}>
            <Glass style={styles.match}>
              <View style={styles.flex}>
                <Txt variant="heading">{label(m.key)}</Txt>
                <View style={[styles.tag, m.strength === 'both_yes' && styles.tagStrong]}>
                  <Txt variant="tiny">{m.strength === 'both_yes' ? s.spicy.matches.bothYes : s.spicy.matches.yesMaybe}</Txt>
                </View>
              </View>
              {inList.has(m.key) ? (
                <Txt variant="small" muted>{s.spicy.matches.inTrySoon}</Txt>
              ) : (
                <Button title={s.spicy.matches.trySoon} small variant="glass" onPress={() => couple && act(() => addTrySoon(couple.id, m.key))} />
              )}
            </Glass>
          </Animated.View>
        ))
      )}

      {d && (
        <Glass style={styles.gap}>
          <Txt variant="heading">{`⏳ ${s.spicy.matches.trySoonTitle}`}</Txt>
          {d.trySoon.length === 0 ? <Txt muted variant="small">{s.spicy.matches.trySoonEmpty}</Txt> : null}
          {d.trySoon.map((t) => (
            <View key={t.item_key} style={[styles.trySoon, t.done_at && styles.done]}>
              <Txt style={styles.flex}>{`${t.done_at ? '✅ ' : ''}${label(t.item_key)}`}</Txt>
              <Button
                title={t.done_at ? s.spicy.matches.doneLabel : s.spicy.matches.markDone}
                small
                variant={t.done_at ? 'ghost' : 'primary'}
                onPress={() => couple && act(() => markTrySoonDone(couple.id, t.item_key, !t.done_at))}
              />
              <Button title={s.spicy.matches.remove} small variant="ghost" onPress={() => couple && act(() => removeTrySoon(couple.id, t.item_key))} />
            </View>
          ))}
        </Glass>
      )}
    </SpicyScreen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  flex: { flex: 1, gap: space.xs },
  match: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tag: { alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: 'rgba(255,200,97,0.18)' },
  tagStrong: { backgroundColor: 'rgba(255,77,109,0.3)' },
  trySoon: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  done: { opacity: 0.55 },
});
