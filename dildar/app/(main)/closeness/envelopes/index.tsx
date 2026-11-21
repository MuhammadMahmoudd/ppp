/** Locked letters / open-when letters — list. */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { Pressy } from '@/components/Pressy';
import { Txt } from '@/components/Txt';
import { Button } from '@/components/Button';
import { EmptyState, ErrorState, SkeletonList } from '@/components/States';
import { colors, radius, space } from '@/lib/theme';
import { fmt, relativeTime, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { tryOpenString } from '@/lib/crypto';
import { useAsync, useNow } from '@/features/closeness/hooks';

export default function Envelopes() {
  const s = useStrings();
  const e = s.closeness.envelopes;
  const { sharedKey, userId, partner } = useSession();
  const now = useNow(30_000);
  const q = useAsync(async () => {
    const { data, error } = await supabase.from('envelopes').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }, []);
  const items = useMemo(() => (q.data ?? []).map((r) => ({ ...r, title: tryOpenString(r.title_ciphertext, r.title_nonce, sharedKey) })), [q.data, sharedKey]);

  return (
    <Screen
      scroll
      header={<Header title={e.title} right={<IconButton name="add" label={e.new} onPress={() => router.push('/closeness/envelopes/new')} />} />}
    >
      <Txt muted>{e.body}</Txt>
      {q.loading && !q.data ? <SkeletonList rows={3} /> : null}
      {q.error ? <ErrorState onRetry={q.reload} /> : null}
      {q.data && items.length === 0 ? <EmptyState emoji="💌" title={e.empty} action={{ label: e.new, onPress: () => router.push('/closeness/envelopes/new') }} /> : null}
      {items.map((it, i) => {
        const mine = it.author_id === userId;
        const locked = !mine && it.kind === 'date' && !!it.unlock_at && new Date(it.unlock_at).getTime() > now;
        return (
          <Animated.View key={it.id} entering={FadeInDown.delay(i * 40)}>
            <Pressy onPress={() => router.push({ pathname: '/closeness/envelopes/[id]', params: { id: it.id } })} style={styles.card} scaleTo={0.98}>
              <Txt style={styles.emoji}>{locked ? '🔒' : it.opened_at ? '📖' : '💌'}</Txt>
              <View style={styles.flex}>
                <Txt variant="heading" numberOfLines={1}>{it.title ?? s.states.decryptFailed}</Txt>
                <Txt variant="small" muted>
                  {(mine ? e.fromYou : fmt(e.fromThem, { name: partner?.display_name ?? s.common.partner })) +
                    ' · ' +
                    (it.opened_at ? e.opened : locked ? e.locked : e.notOpened)}
                </Txt>
                <Txt variant="tiny" muted>{relativeTime(new Date(it.created_at), s)}</Txt>
              </View>
            </Pressy>
          </Animated.View>
        );
      })}
      {items.length > 0 ? <Button title={e.new} variant="glass" onPress={() => router.push('/closeness/envelopes/new')} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  emoji: { fontSize: 30, lineHeight: 40 },
  flex: { flex: 1, gap: 2 },
});
