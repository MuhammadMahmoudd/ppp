/**
 * Daily question. Both phones show the same question (seeded by couple + home
 * day + pool). Answers are E2E encrypted; the partner's answer is released by
 * RLS only after you've answered too, then appears live.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Glass } from '@/components/Glass';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Txt } from '@/components/Txt';
import { ErrorState, Skeleton } from '@/components/States';
import { colors, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { useSession } from '@/lib/session';
import { api } from '@/lib/api';
import { sealString, tryOpenString } from '@/lib/crypto';
import { subscribeTable } from '@/lib/realtime';
import { haptic } from '@/lib/haptics';
import type { DailyAnswerRow } from '@/lib/database.types';
import { Chip } from '@/features/profile/ProfileForm';
import { useAsync, useNow } from '@/features/closeness/hooks';
import { dailyQuestionIndex, todayIn, type Pool } from '@/features/closeness/logic';
import { SPICY_QUESTIONS, SWEET_QUESTIONS } from '@/features/closeness/questions';

export default function DailyQuestion() {
  const s = useStrings();
  const q = s.closeness.question;
  const { locale } = useSettings();
  const { couple, userId, sharedKey, partner, spicyActive } = useSession();
  const [pool, setPool] = useState<Pool>('sweet');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const now = useNow(60_000);
  const tz = couple?.home_timezone ?? 'Asia/Baghdad';
  const day = todayIn(tz, new Date(now));
  const list = pool === 'spicy' ? SPICY_QUESTIONS : SWEET_QUESTIONS;
  const idx = couple ? dailyQuestionIndex(couple.id, day, pool, list.length) : 0;
  const question = list[idx];

  useEffect(() => {
    if (!spicyActive && pool === 'spicy') setPool('sweet');
  }, [spicyActive, pool]);

  const answers = useAsync(async () => {
    if (!couple) return [] as DailyAnswerRow[];
    const { data, error } = await api.from('daily_answers').select('*').eq('couple_id', couple.id).eq('day', day).eq('pool', pool);
    if (error) throw error;
    return data ?? [];
  }, [couple?.id, day, pool]);

  const coupleId = couple?.id;
  const reload = answers.reload;
  useEffect(() => {
    if (!coupleId) return;
    return subscribeTable<DailyAnswerRow>('daily_answers', coupleId, () => reload());
  }, [coupleId, reload]);

  const mine = useMemo(() => answers.data?.find((a) => a.user_id === userId) ?? null, [answers.data, userId]);
  const theirs = useMemo(() => answers.data?.find((a) => a.user_id !== userId) ?? null, [answers.data, userId]);

  const submit = async () => {
    if (!couple || !sharedKey || !text.trim()) return;
    setBusy(true);
    const sealed = sealString(text.trim(), sharedKey);
    const { error } = await api.from('daily_answers').insert({
      couple_id: couple.id, day, pool, question_idx: idx, ciphertext: sealed.c, nonce: sealed.n,
    });
    setBusy(false);
    if (error) {
      haptic.error();
      return;
    }
    haptic.success();
    setText('');
    answers.reload();
  };

  return (
    <Screen scroll header={<Header title={q.title} />}>
      {spicyActive && (
        <ScrollView horizontal contentContainerStyle={styles.chips} showsHorizontalScrollIndicator={false}>
          <Chip label={`🙂 ${q.sweet}`} active={pool === 'sweet'} onPress={() => setPool('sweet')} />
          <Chip label={`🔥 ${q.spicy}`} active={pool === 'spicy'} onPress={() => setPool('spicy')} />
        </ScrollView>
      )}

      <Animated.View key={`${day}-${pool}`} entering={FadeInDown.springify()}>
        <Glass style={styles.gap}>
          <Txt variant="tiny" muted>{day}</Txt>
          <Txt variant="title">{locale === 'en' ? question.en : question.ckb}</Txt>
        </Glass>
      </Animated.View>

      <Txt variant="small" color={colors.coral}>{fmt(q.streak, { n: couple?.question_streak ?? 0 })}</Txt>

      {answers.loading && !answers.data ? <Skeleton height={120} /> : null}
      {answers.error ? <ErrorState onRetry={answers.reload} /> : null}

      {answers.data && !mine && (
        <Glass style={styles.gap}>
          <Txt variant="heading">{q.yourAnswer}</Txt>
          <Input value={text} onChangeText={setText} placeholder={q.placeholder} multiline maxLength={2000} style={styles.answer} />
          <Txt variant="small" muted>{q.hidden}</Txt>
          <Button title={q.submit} onPress={submit} loading={busy} disabled={!text.trim() || !sharedKey} />
        </Glass>
      )}

      {mine && (
        <Animated.View entering={FadeIn}>
          <Glass style={styles.gap}>
            <Txt variant="tiny" color={colors.rose}>{q.yourAnswer}</Txt>
            <Txt>{tryOpenString(mine.ciphertext, mine.nonce, sharedKey) ?? s.states.decryptFailed}</Txt>
          </Glass>
        </Animated.View>
      )}

      {mine && !theirs && <Txt muted center>{q.waiting}</Txt>}

      {mine && theirs && (
        <Animated.View entering={ZoomIn.springify()}>
          <Glass style={[styles.gap, styles.theirs]}>
            <Txt variant="tiny" color={colors.rose}>{fmt(q.theirAnswer, { name: partner?.display_name ?? s.common.partner })}</Txt>
            <Txt>{tryOpenString(theirs.ciphertext, theirs.nonce, sharedKey) ?? s.states.decryptFailed}</Txt>
          </Glass>
        </Animated.View>
      )}
      {mine && theirs ? <View style={styles.center}><Txt variant="small" muted>{q.newTomorrow}</Txt></View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: space.sm },
  gap: { gap: space.sm },
  answer: { minHeight: 110, textAlignVertical: 'top' },
  theirs: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.rose },
  center: { alignItems: 'center' },
});
