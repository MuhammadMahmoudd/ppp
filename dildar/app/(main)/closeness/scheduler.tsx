/**
 * Tease scheduler: write now, deliver later — at a wall-clock time in the
 * RECEIVER's time zone. The message is sealed on-device; the
 * deliver_scheduled function moves it into the chat at deliver_at.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Glass } from '@/components/Glass';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Txt } from '@/components/Txt';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { colors, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { api } from '@/lib/api';
import { sealJSON, tryOpenJSON } from '@/lib/crypto';
import { dayKey, formatClock } from '@/lib/time';
import { haptic } from '@/lib/haptics';
import type { MessageBody } from '@/lib/messages';
import { Chip } from '@/features/profile/ProfileForm';
import { useAsync } from '@/features/closeness/hooks';
import { quickSlots, wallToUtc } from '@/features/closeness/logic';
import { DateTimeFields } from '@/features/closeness/ui';

export default function Scheduler() {
  const s = useStrings();
  const t = s.closeness.scheduler;
  const { couple, sharedKey, partner, me } = useSession();
  const theirTz = partner?.timezone ?? couple?.home_timezone ?? 'Asia/Baghdad';
  const myTz = me?.timezone ?? 'Asia/Baghdad';
  const [text, setText] = useState('');
  const [date, setDate] = useState(() => dayKey(new Date(), theirTz));
  const [time, setTime] = useState('21:00');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const slots = useMemo(() => quickSlots(theirTz), [theirTz]);
  const at = wallToUtc(date, time, theirTz);
  const slotLabel = { tonight: t.quickTonight, morning: t.quickMorning, tomorrowNight: t.quickTomorrowNight };

  const list = useAsync(async () => {
    const { data, error } = await api.from('scheduled_items').select('*').is('delivered_at', null).order('deliver_at');
    if (error) throw error;
    return data ?? [];
  }, []);

  const schedule = async () => {
    if (!couple || !sharedKey || !text.trim()) return;
    if (!at) return setErr(s.closeness.datetime.dateInvalid);
    if (at.getTime() < Date.now() + 30_000) return setErr(s.closeness.datetime.mustBeFuture);
    setBusy(true);
    setErr(null);
    const body: MessageBody = { t: 'text', text: text.trim() };
    const sealed = sealJSON(body, sharedKey);
    const { error } = await api.from('scheduled_items').insert({
      couple_id: couple.id, kind: 'message', message_type: 'text',
      payload_ciphertext: sealed.c, nonce: sealed.n, deliver_at: at.toISOString(),
    });
    setBusy(false);
    if (error) {
      haptic.error();
      return setErr(s.auth.errors.generic);
    }
    haptic.success();
    setText('');
    setDone(true);
    setTimeout(() => setDone(false), 2000);
    list.reload();
  };

  const cancel = async (id: string) => {
    haptic.warning();
    await api.from('scheduled_items').delete().eq('id', id);
    list.reload();
  };

  return (
    <Screen scroll header={<Header title={t.title} />}>
      <Txt muted>{t.body}</Txt>
      <Glass style={styles.gap}>
        <Input value={text} onChangeText={setText} placeholder={t.messagePh} multiline maxLength={2000} style={styles.msg} />
        <Txt variant="small" muted>{fmt(t.theirTime, { zone: theirTz })}</Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {slots.map((q) => <Chip key={q.key} label={slotLabel[q.key]} active={q.date === date && q.time === time} onPress={() => { setDate(q.date); setTime(q.time); setErr(null); }} />)}
        </ScrollView>
        <DateTimeFields date={date} time={time} onDate={setDate} onTime={setTime} error={err} />
        {at ? (
          <View style={styles.preview}>
            <Txt variant="small">{`${t.deliverAt}: ${dayKey(at, theirTz)} ${formatClock(at, theirTz)} (${partner?.display_name ?? s.common.partner})`}</Txt>
            <Txt variant="small" muted>{fmt(t.yourTime, { time: `${dayKey(at, myTz)} ${formatClock(at, myTz)}` })}</Txt>
          </View>
        ) : null}
        <Button title={done ? t.scheduled : t.schedule} onPress={schedule} loading={busy} disabled={!text.trim() || !sharedKey} />
      </Glass>

      <Txt variant="heading">{t.pending}</Txt>
      {list.loading && !list.data ? <Skeleton height={64} /> : null}
      {list.error ? <ErrorState onRetry={list.reload} /> : null}
      {list.data && list.data.length === 0 ? <EmptyState emoji="⏰" title={t.empty} /> : null}
      {(list.data ?? []).map((r) => {
        const b = tryOpenJSON<MessageBody>(r.payload_ciphertext, r.nonce, sharedKey);
        const d = new Date(r.deliver_at);
        return (
          <Animated.View key={r.id} entering={FadeInDown} exiting={FadeOut}>
            <Glass style={styles.gap}>
              <Txt numberOfLines={3}>{b?.t === 'text' ? b.text : s.states.decryptFailed}</Txt>
              <Txt variant="small" color={colors.rose}>{`${dayKey(d, theirTz)} ${formatClock(d, theirTz)} · ${fmt(t.yourTime, { time: formatClock(d, myTz) })}`}</Txt>
              <Button title={t.cancel} variant="glass" small onPress={() => cancel(r.id)} />
            </Glass>
          </Animated.View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  chips: { gap: space.sm },
  msg: { minHeight: 90, textAlignVertical: 'top' },
  preview: { gap: 2, padding: space.md, borderRadius: 14, backgroundColor: colors.surface },
});
