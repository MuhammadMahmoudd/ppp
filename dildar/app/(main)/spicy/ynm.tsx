/** Yes / No / Maybe — private answers; partner only ever sees matches. */
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Glass } from '@/components/Glass';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { Pressy } from '@/components/Pressy';
import { ErrorState, Skeleton } from '@/components/States';
import { colors, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { useSession } from '@/lib/session';
import { haptic } from '@/lib/haptics';
import type { YnmAnswer } from '@/lib/database.types';
import { SpicyScreen } from '@/features/spicy/SpicyScreen';
import { AnswerPills } from '@/features/spicy/AnswerPills';
import { useSpicyUnlocked } from '@/features/spicy/gate';
import { useAsync } from '@/features/spicy/useAsync';
import { YNM_CATEGORIES, YNM_STARTER } from '@/features/spicy/ynmStarter';
import { addCustomItem, deleteCustomItem, loadCustomItems, loadMyAnswers, setAnswer, type CustomItem } from '@/features/spicy/api';

export default function YesNoMaybe() {
  const s = useStrings();
  const { locale } = useSettings();
  const { userId, couple, sharedKey, spicyActive } = useSession();
  const unlocked = useSpicyUnlocked();
  const enabled = spicyActive && unlocked && !!userId;
  const answers = useAsync(() => loadMyAnswers(userId as string), [userId], enabled);
  const custom = useAsync(() => loadCustomItems(userId as string, sharedKey), [userId, sharedKey], enabled);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const total = YNM_STARTER.length + (custom.data?.length ?? 0);
  const answered = useMemo(() => Object.keys(answers.data ?? {}).length, [answers.data]);

  const answer = async (key: string, a: YnmAnswer | null) => {
    if (!couple) return;
    const prev = answers.data ?? {};
    const next = { ...prev };
    if (a) next[key] = a;
    else delete next[key];
    answers.setData(next);
    try {
      await setAnswer(couple.id, key, a);
    } catch {
      haptic.error();
      answers.setData(prev);
    }
  };

  const add = async () => {
    if (!couple || !sharedKey || !draft.trim()) return;
    setAdding(true);
    try {
      await addCustomItem(couple.id, draft, sharedKey);
      setDraft('');
      haptic.success();
      await custom.reload();
    } catch {
      haptic.error();
    } finally {
      setAdding(false);
    }
  };

  const remove = (c: CustomItem) =>
    Alert.alert(s.spicy.ynm.deleteCustom, c.text, [
      { text: s.common.cancel, style: 'cancel' },
      { text: s.common.delete, style: 'destructive', onPress: async () => { await deleteCustomItem(c.id).catch(() => undefined); custom.reload(); answers.reload(); } },
    ]);

  const right = <IconButton name="sparkles-outline" label={s.spicy.ynm.seeMatches} onPress={() => router.push('/spicy/matches')} />;

  return (
    <SpicyScreen title={s.spicy.ynm.title} right={right}>
      <Txt muted>{s.spicy.ynm.intro}</Txt>
      <Txt variant="small" color={colors.rose}>{fmt(s.spicy.ynm.answered, { n: answered, total })}</Txt>

      {answers.error ? <ErrorState onRetry={answers.reload} /> : null}
      {answers.loading && !answers.data ? (
        <View style={styles.gap}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={56} />)}</View>
      ) : null}

      {answers.data &&
        YNM_CATEGORIES.map((cat) => (
          <Glass key={cat} style={styles.gap}>
            <Txt variant="heading">{s.spicy.ynm.categories[cat]}</Txt>
            {YNM_STARTER.filter((i) => i.category === cat).map((i) => (
              <View key={i.key} style={styles.item}>
                <Txt style={styles.flex}>{i[locale]}</Txt>
                <AnswerPills value={answers.data?.[i.key]} onChange={(a) => answer(i.key, a)} />
              </View>
            ))}
          </Glass>
        ))}

      {answers.data && (
        <Glass style={styles.gap}>
          <Txt variant="heading">{s.spicy.ynm.categories.custom}</Txt>
          {(custom.data ?? []).map((c) => (
            <View key={c.id} style={styles.item}>
              <Pressy onLongPress={c.mine ? () => remove(c) : undefined} hapticStyle="none" style={styles.flex}>
                <Txt>{c.text}</Txt>
              </Pressy>
              <AnswerPills value={answers.data?.[c.key]} onChange={(a) => answer(c.key, a)} />
            </View>
          ))}
          <Input value={draft} onChangeText={setDraft} placeholder={s.spicy.ynm.customPlaceholder} maxLength={120} onSubmitEditing={add} returnKeyType="done" />
          <Button title={s.spicy.ynm.addCustom} onPress={add} loading={adding} disabled={!draft.trim() || !sharedKey} variant="glass" small icon={<Ionicons name="add" size={18} color={colors.text} />} />
        </Glass>
      )}
      <Txt variant="small" muted center>{s.spicy.privateNote}</Txt>
    </SpicyScreen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  item: { gap: space.sm, paddingVertical: space.xs },
  flex: { flex: 1 },
});
