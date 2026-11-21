/**
 * Countdown to the next visit + the locked "first night back" plan.
 * Your plan entries are always visible to you; theirs unlock (RLS) the moment
 * the countdown ends, with a reveal animation.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Glass } from '@/components/Glass';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Txt } from '@/components/Txt';
import { IconButton } from '@/components/IconButton';
import { ErrorState, Skeleton } from '@/components/States';
import { colors, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { sealString, tryOpenString } from '@/lib/crypto';
import { dayKey, formatClock } from '@/lib/time';
import { haptic } from '@/lib/haptics';
import type { PlanItemRow } from '@/lib/database.types';
import { useAsync, useCountdown, useNow } from '@/features/closeness/hooks';
import { countdownParts, wallToUtc } from '@/features/closeness/logic';
import { CountdownDigits, DateTimeFields } from '@/features/closeness/ui';

export default function CountdownScreen() {
  const s = useStrings();
  const c = s.closeness.countdown;
  const { couple, userId, sharedKey, me, partner } = useSession();
  const { row, title, loaded, error, reload } = useCountdown();
  const now = useNow(1000);
  const myTz = me?.timezone ?? 'Asia/Baghdad';

  const [editing, setEditing] = useState(false);
  const [tTitle, setTTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (row) {
      const d = new Date(row.target_at);
      setTTitle(title ?? '');
      setDate(dayKey(d, myTz));
      setTime(formatClock(d, myTz));
    }
  }, [row, title, myTz]);

  const arrived = row ? countdownParts(row.target_at, now).arrived : false;

  const save = async () => {
    if (!couple || !sharedKey) return;
    const at = wallToUtc(date, time, myTz);
    if (!at) return setFormErr(s.closeness.datetime.dateInvalid);
    if (at.getTime() < Date.now()) return setFormErr(s.closeness.datetime.mustBeFuture);
    setBusy(true);
    setFormErr(null);
    const sealed = tTitle.trim() ? sealString(tTitle.trim(), sharedKey) : null;
    const patch = { target_at: at.toISOString(), title_ciphertext: sealed?.c ?? null, title_nonce: sealed?.n ?? null };
    const res = row && !arrived
      ? await supabase.from('countdowns').update(patch).eq('id', row.id)
      : await supabase.from('countdowns').insert({ couple_id: couple.id, ...patch });
    setBusy(false);
    if (res.error) {
      haptic.error();
      return setFormErr(s.auth.errors.generic);
    }
    haptic.success();
    setEditing(false);
    await reload();
  };

  const remove = () =>
    row &&
    Alert.alert(c.deleteConfirm, undefined, [
      { text: s.common.cancel, style: 'cancel' },
      { text: c.delete, style: 'destructive', onPress: async () => { await supabase.from('countdowns').delete().eq('id', row.id); haptic.warning(); await reload(); } },
    ]);

  if (!loaded) return <Screen header={<Header title={c.title} />}><View style={styles.pad}><Skeleton height={160} /></View></Screen>;
  if (error) return <Screen header={<Header title={c.title} />}><ErrorState onRetry={reload} /></Screen>;

  const showForm = !row || editing || arrived;

  return (
    <Screen
      scroll
      header={<Header title={c.title} right={row && !editing && !arrived ? <IconButton name="create-outline" label={c.edit} onPress={() => setEditing(true)} /> : undefined} />}
    >
      {row && (
        <Animated.View entering={FadeInDown.springify()}>
          <Glass style={styles.center}>
            <Txt variant="heading" center>{arrived ? c.arrived : title || c.defaultTitle}</Txt>
            {!arrived && <CountdownDigits targetIso={row.target_at} now={now} />}
            {arrived && <Animated.View entering={ZoomIn.springify()}><Txt style={styles.big}>❤️</Txt></Animated.View>}
            <Txt variant="small" muted center>{`${dayKey(new Date(row.target_at), myTz)} · ${formatClock(new Date(row.target_at), myTz)}`}</Txt>
            {partner && partner.timezone !== myTz ? (
              <Txt variant="small" muted center>{fmt(s.profile.localTime, { time: `${dayKey(new Date(row.target_at), partner.timezone)} ${formatClock(new Date(row.target_at), partner.timezone)}` })}</Txt>
            ) : null}
          </Glass>
        </Animated.View>
      )}

      {showForm && (
        <Glass style={styles.gap}>
          {!row && <Txt variant="heading">{c.noneTitle}</Txt>}
          {!row && <Txt variant="small" muted>{c.noneBody}</Txt>}
          <Input label={c.titleLabel} value={tTitle} onChangeText={setTTitle} placeholder={c.titlePh} maxLength={60} />
          <DateTimeFields date={date} time={time} onDate={setDate} onTime={setTime} error={formErr} />
          <Txt variant="tiny" muted>{s.closeness.datetime.inYourZone} · {myTz}</Txt>
          <Button title={row && !arrived ? s.common.save : c.add} onPress={save} loading={busy} />
          {row && editing && (
            <View style={styles.row}>
              <Button title={s.common.cancel} variant="glass" small onPress={() => setEditing(false)} style={styles.flex} />
              <Button title={c.delete} variant="danger" small onPress={remove} style={styles.flex} />
            </View>
          )}
        </Glass>
      )}

      {row && couple && userId && <Plan countdownId={row.id} coupleId={couple.id} userId={userId} sharedKey={sharedKey} arrived={arrived} />}
    </Screen>
  );
}

function Plan({ countdownId, coupleId, userId, sharedKey, arrived }: { countdownId: string; coupleId: string; userId: string; sharedKey: Uint8Array | null; arrived: boolean }) {
  const s = useStrings();
  const c = s.closeness.countdown;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const q = useAsync(async () => {
    const { data, error } = await supabase.from('plan_items').select('*').eq('countdown_id', countdownId).order('created_at');
    if (error) throw error;
    return data ?? [];
  }, [countdownId, arrived]);

  const items = useMemo(() => (q.data ?? []).map((r: PlanItemRow) => ({ ...r, text: tryOpenString(r.ciphertext, r.nonce, sharedKey) })), [q.data, sharedKey]);
  const mine = items.filter((i) => i.author_id === userId);
  const theirs = items.filter((i) => i.author_id !== userId);

  const add = async () => {
    if (!sharedKey || !text.trim()) return;
    setBusy(true);
    const sealed = sealString(text.trim(), sharedKey);
    const { error } = await supabase.from('plan_items').insert({ countdown_id: countdownId, couple_id: coupleId, ciphertext: sealed.c, nonce: sealed.n });
    setBusy(false);
    if (!error) {
      haptic.success();
      setText('');
      q.reload();
    } else haptic.error();
  };

  return (
    <Glass style={styles.gap}>
      <Txt variant="heading">{c.planTitle}</Txt>
      <Txt variant="small" muted>{c.planBody}</Txt>
      {q.loading && !q.data ? <Skeleton height={44} /> : null}
      {q.error ? <ErrorState onRetry={q.reload} /> : null}

      <Txt variant="tiny" color={colors.rose}>{c.planYours}</Txt>
      {mine.length === 0 && !q.loading ? <Txt variant="small" muted>{c.planEmpty}</Txt> : null}
      {mine.map((i) => (
        <View key={i.id} style={styles.item}>
          <Txt style={styles.flex}>{i.text ?? s.states.decryptFailed}</Txt>
          <IconButton name="trash-outline" size={16} label={s.common.delete} glass={false} onPress={async () => { await supabase.from('plan_items').delete().eq('id', i.id); q.reload(); }} />
        </View>
      ))}

      {!arrived && (
        <>
          <Input value={text} onChangeText={setText} placeholder={c.planPh} multiline maxLength={400} />
          <Button title={c.planAdd} onPress={add} loading={busy} disabled={!text.trim()} small />
        </>
      )}

      <Txt variant="tiny" color={colors.rose}>{arrived ? c.planRevealed : c.planTheirs}</Txt>
      {!arrived && <Txt variant="small" muted>{c.planLocked}</Txt>}
      {arrived && theirs.map((i, idx) => (
        <Animated.View key={i.id} entering={ZoomIn.delay(200 + idx * 180).springify()} style={[styles.item, styles.revealed]}>
          <Txt style={styles.flex}>💌 {i.text ?? s.states.decryptFailed}</Txt>
        </Animated.View>
      ))}
    </Glass>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.lg },
  center: { alignItems: 'center', gap: space.md },
  big: { fontSize: 64, lineHeight: 80 },
  gap: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: 14, backgroundColor: colors.surface },
  revealed: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.rose },
});
