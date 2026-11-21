/**
 * Phase 8 shared lists — bucket list, coupon book, memory timeline.
 * One table (shared_items), content is an encrypted JSON blob.
 */
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Glass } from '@/components/Glass';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Pressy } from '@/components/Pressy';
import { Txt } from '@/components/Txt';
import { EmptyState, ErrorState, SkeletonList } from '@/components/States';
import { colors, radius, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { sealJSON, tryOpenJSON } from '@/lib/crypto';
import { dayKey } from '@/lib/time';
import { haptic } from '@/lib/haptics';
import type { SharedItemRow } from '@/lib/database.types';
import { useAsync } from '@/features/closeness/hooks';
import { parseDate } from '@/features/closeness/logic';

type Kind = SharedItemRow['kind'];
type Body = { text: string };
const KINDS: Kind[] = ['bucket', 'coupon', 'memory'];
const EMOJI: Record<Kind, string> = { bucket: '🌍', coupon: '🎟️', memory: '📸' };

export default function SharedList() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kind: Kind = KINDS.includes(params.kind as Kind) ? (params.kind as Kind) : 'bucket';
  const s = useStrings();
  const l = s.closeness.lists;
  const { couple, userId, sharedKey, me } = useSession();
  const [text, setText] = useState('');
  const [date, setDate] = useState(() => dayKey(new Date(), me?.timezone ?? 'Asia/Baghdad'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const q = useAsync(async () => {
    const { data, error } = await supabase.from('shared_items').select('*').eq('kind', kind).order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }, [kind]);

  const items = useMemo(() => {
    const rows = (q.data ?? []).map((r) => ({ ...r, body: tryOpenJSON<Body>(r.ciphertext, r.nonce, sharedKey) }));
    if (kind === 'memory') rows.sort((a, b) => (b.happened_on ?? '').localeCompare(a.happened_on ?? ''));
    if (kind === 'bucket' || kind === 'coupon') rows.sort((a, b) => Number(!!a.done_at) - Number(!!b.done_at));
    return rows;
  }, [q.data, sharedKey, kind]);

  const title = kind === 'bucket' ? l.bucket : kind === 'coupon' ? l.coupon : l.memory;
  const subtitle = kind === 'bucket' ? l.bucketBody : kind === 'coupon' ? l.couponBody : l.memoryBody;
  const ph = kind === 'bucket' ? l.bucketPh : kind === 'coupon' ? l.couponPh : l.memoryPh;

  const add = async () => {
    if (!couple || !sharedKey || !text.trim()) return;
    if (kind === 'memory' && !parseDate(date)) return setErr(s.closeness.datetime.dateInvalid);
    setBusy(true);
    setErr(null);
    const sealed = sealJSON({ text: text.trim() } satisfies Body, sharedKey);
    const { error } = await supabase.from('shared_items').insert({
      couple_id: couple.id, kind, ciphertext: sealed.c, nonce: sealed.n,
      happened_on: kind === 'memory' ? date : null,
    });
    setBusy(false);
    if (error) {
      haptic.error();
      return setErr(s.auth.errors.generic);
    }
    haptic.success();
    setText('');
    q.reload();
  };

  const toggleDone = async (r: SharedItemRow) => {
    const apply = async () => {
      haptic.success();
      await supabase.from('shared_items').update({ done_at: r.done_at ? null : new Date().toISOString() }).eq('id', r.id);
      q.reload();
    };
    if (kind === 'coupon' && !r.done_at) {
      Alert.alert(l.redeemConfirm, undefined, [{ text: s.common.cancel, style: 'cancel' }, { text: l.redeem, onPress: apply }]);
    } else apply();
  };

  const remove = (r: SharedItemRow) =>
    Alert.alert(l.deleteConfirm, undefined, [
      { text: s.common.cancel, style: 'cancel' },
      { text: s.common.delete, style: 'destructive', onPress: async () => { haptic.warning(); await supabase.from('shared_items').delete().eq('id', r.id); q.reload(); } },
    ]);

  return (
    <Screen scroll header={<Header title={title} />}>
      <Txt muted>{subtitle}</Txt>
      <Glass style={styles.gap}>
        <Input value={text} onChangeText={setText} placeholder={ph} multiline maxLength={500} />
        {kind === 'memory' && <Input label={l.memoryDate} value={date} onChangeText={setDate} placeholder={s.closeness.datetime.datePh} keyboardType="numbers-and-punctuation" />}
        {err ? <Txt color={colors.danger}>{err}</Txt> : null}
        <Button title={l.add} onPress={add} loading={busy} disabled={!text.trim() || !sharedKey} small />
      </Glass>

      {q.loading && !q.data ? <SkeletonList rows={4} /> : null}
      {q.error ? <ErrorState onRetry={q.reload} /> : null}
      {q.data && items.length === 0 ? <EmptyState emoji={EMOJI[kind]} title={l.empty} /> : null}

      <View style={kind === 'memory' ? styles.timeline : styles.gap}>
        {items.map((r, i) => (
          <Animated.View key={r.id} entering={FadeInDown.delay(Math.min(i, 8) * 30)} exiting={FadeOut} layout={LinearTransition.springify()}>
            <Pressy onLongPress={() => remove(r)} onPress={kind === 'memory' ? undefined : () => toggleDone(r)} scaleTo={0.98} style={[styles.item, !!r.done_at && styles.done, kind === 'coupon' && styles.coupon]}>
              {kind === 'memory' ? (
                <View style={styles.dot} />
              ) : (
                <Ionicons name={r.done_at ? 'checkmark-circle' : kind === 'coupon' ? 'ticket-outline' : 'ellipse-outline'} size={24} color={r.done_at ? colors.success : colors.rose} />
              )}
              <View style={styles.flex}>
                {kind === 'memory' && r.happened_on ? <Txt variant="tiny" color={colors.rose}>{r.happened_on}</Txt> : null}
                <Txt style={r.done_at && kind !== 'memory' ? styles.strike : undefined}>{r.body?.text ?? s.states.decryptFailed}</Txt>
                {kind === 'coupon' ? <Txt variant="tiny" muted>{r.done_at ? l.redeemed : l.redeem}</Txt> : null}
                {kind === 'bucket' && r.done_at ? <Txt variant="tiny" color={colors.success}>{l.done}</Txt> : null}
                {r.created_by === userId ? null : <Txt variant="tiny" muted>💗</Txt>}
              </View>
            </Pressy>
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  timeline: { gap: space.md, borderStartWidth: 2, borderStartColor: 'rgba(255,107,139,0.35)', paddingStart: space.md, marginStart: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  coupon: { borderStyle: 'dashed', borderColor: colors.rose, borderWidth: 1 },
  done: { opacity: 0.6 },
  strike: { textDecorationLine: 'line-through' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.rose, marginStart: -space.md - 7 },
  flex: { flex: 1, gap: 2 },
});
