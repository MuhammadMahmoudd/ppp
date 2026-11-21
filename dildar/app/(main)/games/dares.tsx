/**
 * Dare queue (async): send a dare with a deadline when you can't call.
 * Dares live in the chat as cards with a countdown; proof can be a
 * view-once snap or a voice note.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Glass } from '@/components/Glass';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { HeatBadge } from '@/components/HeatBadge';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { colors, space } from '@/lib/theme';
import { fmt, num, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { secureRandomInt } from '@/lib/crypto';
import { haptic } from '@/lib/haptics';
import { splitDuration } from '@/lib/time';
import type { Heat } from '@/lib/database.types';
import { useDecks } from '@/features/decks/useDecks';
import { poolFor } from '@/features/decks/pools';
import { textOf } from '@/features/decks/text';
import { Chip } from '@/features/profile/ProfileForm';
import { HeatPicker } from '@/features/games/ui/HeatPicker';
import { Segmented } from '@/features/games/ui/Segmented';
import { VoiceProof } from '@/features/games/VoiceProof';
import { completeDare, fetchDares, isOpen, sendDare, type DareProof, type DareView } from '@/features/games/dares';

const DEADLINES = [
  { key: 'in1h', ms: 3600_000 },
  { key: 'in6h', ms: 6 * 3600_000 },
  { key: 'in24h', ms: 24 * 3600_000 },
  { key: 'in3d', ms: 72 * 3600_000 },
] as const;

export default function DareQueue() {
  const s = useStrings();
  const { locale } = useSettings();
  const { couple, userId, sharedKey, spicyActive } = useSession();
  const { cards } = useDecks();
  const [text, setText] = useState('');
  const [heat, setHeat] = useState<Heat>(1);
  const [proof, setProof] = useState<'none' | 'snap' | 'voice'>('none');
  const [deadline, setDeadline] = useState<(typeof DEADLINES)[number]['key']>('in24h');
  const [busy, setBusy] = useState(false);
  const [sentMsg, setSentMsg] = useState(false);
  const [dares, setDares] = useState<DareView[] | null>(null);
  const [error, setError] = useState(false);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!sharedKey || !userId) return;
    try {
      setDares(await fetchDares(sharedKey, userId));
      setError(false);
    } catch {
      setError(true);
    }
  }, [sharedKey, userId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const random = () => {
    const pool = poolFor('dare', cards, { heat });
    const c = pool[secureRandomInt(pool.length)];
    if (c) setText(textOf(c.text, locale));
    haptic.tap();
  };

  const send = async () => {
    if (!couple || !userId || !sharedKey || !text.trim()) return;
    setBusy(true);
    try {
      await sendDare({
        coupleId: couple.id, me: userId, key: sharedKey, text, heat,
        proof: (proof === 'none' ? null : proof) as DareProof,
        deadlineMs: DEADLINES.find((d) => d.key === deadline)?.ms ?? 24 * 3600_000,
      });
      haptic.success();
      setText('');
      setSentMsg(true);
      setTimeout(load, 800);
    } finally {
      setBusy(false);
    }
  };

  const complete = async (d: DareView) => {
    if (d.proof === 'snap') return router.push(`/snap/compose?proofFor=${d.id}` as never);
    if (d.proof === 'voice') return setRecordingFor(d.id);
    await completeDare(d.id).catch(() => undefined);
    haptic.success();
    load();
  };

  const left = (d: DareView) => {
    const ms = new Date(d.deadline).getTime() - now;
    if (ms <= 0) return s.games.dares.expired;
    const p = splitDuration(ms);
    const t = p.d ? fmt(s.common.days, { n: p.d }) : p.h ? fmt(s.common.hours, { n: p.h }) : fmt(s.common.minutes, { n: Math.max(1, p.m) });
    return fmt(s.games.dares.timeLeft, { time: t });
  };

  const open = (dares ?? []).filter((d) => isOpen(d, now));
  const closed = (dares ?? []).filter((d) => !isOpen(d, now)).slice(0, 10);

  return (
    <Screen header={<Header title={s.games.dares.title} />}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        <Txt muted variant="small">{s.games.dares.subtitle}</Txt>
        <Glass style={styles.gap}>
          <Txt variant="heading">{s.games.dares.compose}</Txt>
          <HeatPicker value={heat} onChange={setHeat} maxHeat={spicyActive ? 4 : 2} />
          <Input value={text} onChangeText={(t) => { setText(t); setSentMsg(false); }} placeholder={s.games.dares.text} multiline maxLength={500} />
          <Button title={s.games.dares.random} variant="ghost" small onPress={random} />
          <Txt variant="small" muted>{s.games.dares.proof}</Txt>
          <Segmented value={proof} onChange={setProof} options={[
            { value: 'none', label: s.games.dares.proofNone },
            { value: 'snap', label: s.games.dares.proofSnap },
            { value: 'voice', label: s.games.dares.proofVoice },
          ]} />
          <Txt variant="small" muted>{s.games.dares.deadline}</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {DEADLINES.map((d) => <Chip key={d.key} label={s.games.dares[d.key]} active={deadline === d.key} onPress={() => setDeadline(d.key)} />)}
          </ScrollView>
          <Button title={s.games.dares.send} onPress={send} loading={busy} disabled={!text.trim()} />
          {sentMsg && <Txt color={colors.success} center variant="small">{s.games.dares.sent}</Txt>}
        </Glass>

        <Txt variant="heading">{s.games.dares.open}</Txt>
        {dares === null && !error ? (
          <><Skeleton height={90} /><Skeleton height={90} /></>
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : open.length === 0 ? (
          <EmptyState emoji="🔥" title={s.games.dares.empty} />
        ) : (
          open.map((d) => (
            <Glass key={d.id} style={styles.gap}>
              <View style={styles.row}>
                <HeatBadge heat={d.heat} />
                <Txt variant="tiny" muted>{d.fromMe ? s.games.dares.fromYou : s.games.dares.forYou}</Txt>
                <View style={styles.flex} />
                <Txt variant="tiny" color={colors.warning}>{left(d)}</Txt>
              </View>
              <Txt variant="heading">{d.text}</Txt>
              {d.proof ? <Txt variant="tiny" muted>{d.proof === 'snap' ? s.games.dares.proofSnap : s.games.dares.proofVoice}</Txt> : null}
              {!d.fromMe && (recordingFor === d.id ? (
                <VoiceProof dareId={d.id} onDone={() => { setRecordingFor(null); load(); }} />
              ) : (
                <Button
                  small
                  title={d.proof === 'snap' ? s.games.dares.completeSnap : d.proof === 'voice' ? s.games.dares.completeVoice : s.games.dares.complete}
                  onPress={() => complete(d)}
                />
              ))}
            </Glass>
          ))
        )}

        {closed.length > 0 && closed.map((d) => (
          <View key={d.id} style={styles.closed}>
            <Txt variant="small" muted style={styles.flex} numberOfLines={1}>{d.text}</Txt>
            <Txt variant="tiny" color={d.doneAt ? colors.success : colors.textFaint}>{d.doneAt ? s.games.dares.done : s.games.dares.expired}</Txt>
          </View>
        ))}
        <Txt variant="tiny" muted center>{fmt(s.games.dares.openCount, { n: num(open.length) })}</Txt>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  gap: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  chips: { gap: space.sm },
  closed: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
