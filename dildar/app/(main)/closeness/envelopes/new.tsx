/** Write a locked letter: opens on a date, or "open when…" on demand. */
import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Glass } from '@/components/Glass';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Txt } from '@/components/Txt';
import { colors, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { sealString } from '@/lib/crypto';
import { addDays, dayKey, formatClock } from '@/lib/time';
import { postMessage } from '@/lib/messages';
import { haptic } from '@/lib/haptics';
import { Chip } from '@/features/profile/ProfileForm';
import { wallToUtc } from '@/features/closeness/logic';
import { DateTimeFields } from '@/features/closeness/ui';

export default function NewEnvelope() {
  const s = useStrings();
  const e = s.closeness.envelopes;
  const { couple, userId, sharedKey, me, partner } = useSession();
  const myTz = me?.timezone ?? 'Asia/Baghdad';
  const [kind, setKind] = useState<'date' | 'when'>('when');
  const [title, setTitle] = useState('');
  const [letter, setLetter] = useState('');
  const [date, setDate] = useState(() => addDays(dayKey(new Date(), myTz), 7));
  const [time, setTime] = useState('09:00');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const examples = [e.whenEx1, e.whenEx2, e.whenEx3, e.whenEx4];
  const unlockAt = kind === 'date' ? wallToUtc(date, time, myTz) : null;

  const send = async () => {
    if (!couple || !userId || !sharedKey) return;
    if (!title.trim() || !letter.trim()) return;
    if (kind === 'date') {
      if (!unlockAt) return setErr(s.closeness.datetime.dateInvalid);
      if (unlockAt.getTime() < Date.now()) return setErr(s.closeness.datetime.mustBeFuture);
    }
    setBusy(true);
    setErr(null);
    try {
      const t = sealString(title.trim(), sharedKey);
      const { data, error } = await supabase
        .from('envelopes')
        .insert({ couple_id: couple.id, kind, title_ciphertext: t.c, title_nonce: t.n, unlock_at: unlockAt?.toISOString() ?? null })
        .select('id')
        .single();
      if (error || !data) throw error ?? new Error('insert');
      const l = sealString(letter, sharedKey);
      const c = await supabase.from('envelope_contents').insert({ envelope_id: data.id, couple_id: couple.id, ciphertext: l.c, nonce: l.n });
      if (c.error) {
        await supabase.from('envelopes').delete().eq('id', data.id);
        throw c.error;
      }
      await postMessage({ coupleId: couple.id, senderId: userId, key: sharedKey, type: 'envelope', body: { t: 'envelope', envelopeId: data.id, title: title.trim() } });
      haptic.success();
      router.replace({ pathname: '/closeness/envelopes/[id]', params: { id: data.id } });
    } catch {
      haptic.error();
      setErr(s.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll header={<Header title={e.new} />}>
      <ScrollView horizontal contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
        <Chip label={e.kindWhen} active={kind === 'when'} onPress={() => setKind('when')} />
        <Chip label={e.kindDate} active={kind === 'date'} onPress={() => setKind('date')} />
      </ScrollView>
      <Glass style={styles.gap}>
        <Input label={e.titleLabel} value={title} onChangeText={setTitle} placeholder={kind === 'when' ? e.titlePhWhen : e.titlePhDate} maxLength={80} />
        {kind === 'when' && (
          <ScrollView horizontal contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
            {examples.map((x) => <Chip key={x} label={x} active={title === x} onPress={() => setTitle(x)} />)}
          </ScrollView>
        )}
        <Input label={e.letterLabel} value={letter} onChangeText={setLetter} placeholder={e.letterPh} multiline maxLength={8000} style={styles.letter} />
        {kind === 'date' && (
          <>
            <Txt variant="small" muted>{e.unlockAt}</Txt>
            <DateTimeFields date={date} time={time} onDate={setDate} onTime={setTime} />
            {unlockAt && partner && partner.timezone !== myTz ? (
              <Txt variant="tiny" muted>{`${s.closeness.datetime.inYourZone} · ${partner.display_name}: ${dayKey(unlockAt, partner.timezone)} ${formatClock(unlockAt, partner.timezone)}`}</Txt>
            ) : null}
          </>
        )}
        {err ? <Txt color={colors.danger}>{err}</Txt> : null}
        <Button title={e.send} onPress={send} loading={busy} disabled={!title.trim() || !letter.trim() || !sharedKey} />
      </Glass>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  chips: { gap: space.sm },
  letter: { minHeight: 180, textAlignVertical: 'top' },
});
