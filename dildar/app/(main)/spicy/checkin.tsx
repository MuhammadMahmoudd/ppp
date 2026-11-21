/** Monthly boundaries check-in: step through your answers, then record it. */
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { Glass } from '@/components/Glass';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { ErrorState, Skeleton } from '@/components/States';
import { colors, radius, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { useReducedMotion, useSettings } from '@/lib/settings';
import { useSession } from '@/lib/session';
import { haptic } from '@/lib/haptics';
import type { YnmAnswer } from '@/lib/database.types';
import { SpicyScreen } from '@/features/spicy/SpicyScreen';
import { AnswerPills } from '@/features/spicy/AnswerPills';
import { useSpicyUnlocked } from '@/features/spicy/gate';
import { useAsync } from '@/features/spicy/useAsync';
import { YNM_STARTER } from '@/features/spicy/ynmStarter';
import { lastCheckin, loadCustomItems, loadMyAnswers, recordCheckin, setAnswer } from '@/features/spicy/api';

export default function Checkin() {
  const s = useStrings();
  const { locale } = useSettings();
  const reduce = useReducedMotion();
  const { userId, couple, sharedKey, spicyActive } = useSession();
  const unlocked = useSpicyUnlocked();
  const enabled = spicyActive && unlocked && !!userId;
  const data = useAsync(
    async () => {
      const [answers, custom, last] = await Promise.all([loadMyAnswers(userId as string), loadCustomItems(userId as string, sharedKey), lastCheckin(userId as string)]);
      return { answers, custom, last };
    },
    [userId, sharedKey],
    enabled,
  );
  const [i, setI] = useState(0);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);

  // Review answered items first (that's what a boundary refresh is about), then the rest.
  const items = useMemo(() => {
    if (!data.data) return [];
    const all = [
      ...YNM_STARTER.map((x) => ({ key: x.key, label: x[locale] })),
      ...data.data.custom.map((c) => ({ key: c.key, label: c.text })),
    ];
    const a = data.data.answers;
    return [...all.filter((x) => a[x.key]), ...all.filter((x) => !a[x.key])];
  }, [data.data, locale]);

  const finish = async () => {
    if (!couple) return;
    setSaving(true);
    try {
      await recordCheckin(couple.id);
      haptic.success();
      setFinished(true);
    } catch {
      haptic.error();
    } finally {
      setSaving(false);
    }
  };

  const choose = async (key: string, a: YnmAnswer | null) => {
    if (!couple || !data.data) return;
    data.setData({ ...data.data, answers: (() => { const n = { ...data.data.answers }; if (a) n[key] = a; else delete n[key]; return n; })() });
    setAnswer(couple.id, key, a).catch(() => {
      haptic.error();
    });
    setTimeout(() => setI((x) => x + 1), 180);
  };

  const label: Record<YnmAnswer, string> = { yes: s.spicy.ynm.yes, maybe: s.spicy.ynm.maybe, no: s.spicy.ynm.no };

  let content: React.ReactNode;
  if (data.error) content = <ErrorState onRetry={data.reload} />;
  else if (!data.data) content = <Skeleton height={220} />;
  else if (finished) {
    content = (
      <Glass style={styles.center}>
        <Txt style={styles.emoji}>🌙</Txt>
        <Txt variant="heading" center>{s.spicy.checkin.done}</Txt>
        <Button title={s.common.done} onPress={() => router.back()} style={styles.stretch} />
      </Glass>
    );
  } else {
    const cur = items[Math.min(i, items.length - 1)];
    const atEnd = i >= items.length;
    content = (
      <View style={styles.gap}>
        <Txt muted>{s.spicy.checkin.intro}</Txt>
        <Txt variant="small" muted>{data.data.last ? fmt(s.spicy.checkin.last, { date: new Date(data.data.last).toLocaleDateString(locale === 'ckb' ? 'ckb-IQ' : 'en-GB') }) : s.spicy.checkin.never}</Txt>
        {!atEnd && cur ? (
          <Animated.View key={cur.key} entering={reduce ? undefined : FadeInRight.springify()} exiting={reduce ? undefined : FadeOutLeft}>
            <Glass style={styles.card}>
              <Txt variant="tiny" color={colors.rose}>{fmt(s.spicy.checkin.progress, { i: i + 1, n: items.length })}</Txt>
              <Txt variant="title" center>{cur.label}</Txt>
              <Txt variant="small" muted center>
                {fmt(s.spicy.checkin.current, { answer: data.data.answers[cur.key] ? label[data.data.answers[cur.key]] : s.spicy.checkin.unanswered })}
              </Txt>
              <AnswerPills large value={data.data.answers[cur.key]} onChange={(a) => choose(cur.key, a)} />
              <Button title={s.spicy.checkin.keep} variant="ghost" small onPress={() => setI(i + 1)} />
            </Glass>
          </Animated.View>
        ) : (
          <Glass style={styles.center}><Txt variant="heading" center>✨</Txt></Glass>
        )}
        <View style={styles.progress}><View style={[styles.fill, { width: `${items.length ? Math.round((Math.min(i, items.length) / items.length) * 100) : 0}%` }]} /></View>
        <Button title={atEnd ? s.spicy.checkin.finish : s.spicy.checkin.finishAll} onPress={finish} loading={saving} variant={atEnd ? 'primary' : 'glass'} />
      </View>
    );
  }

  return <SpicyScreen title={s.spicy.checkin.title}>{content}</SpicyScreen>;
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  card: { gap: space.lg, alignItems: 'stretch', paddingVertical: space.xl },
  center: { alignItems: 'center', gap: space.md },
  emoji: { fontSize: 48, lineHeight: 60 },
  stretch: { alignSelf: 'stretch' },
  progress: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceStrong, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.accent },
});
