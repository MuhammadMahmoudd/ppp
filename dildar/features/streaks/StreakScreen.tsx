/** Streak (زنجیرە) details: count, status, freeze, 14-day grid, mini streaks, level. */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Glass } from '@/components/Glass';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { ErrorState, Skeleton } from '@/components/States';
import { colors, radius, space } from '@/lib/theme';
import { fmt, num, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { api, errorCode } from '@/lib/api';
import { subscribeTable } from '@/lib/realtime';
import { addDays, dayKey, splitDuration } from '@/lib/time';
import { MILESTONES, coupleLevel, freezesAvailable, streakStatus } from '@/lib/streak';
import { haptic } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/settings';
import type { StreakDayRow } from '@/lib/database.types';

export function StreakScreen() {
  const s = useStrings();
  const { couple, role } = useSession();
  const reduce = useReducedMotion();
  const [days, setDays] = useState<StreakDayRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const flame = useSharedValue(1);

  const load = useCallback(async () => {
    if (!couple) return;
    setFailed(false);
    const since = addDays(dayKey(new Date(), couple.home_timezone), -13);
    const { data, error } = await api.from('streak_days').select('*').eq('couple_id', couple.id).gte('day', since).order('day');
    if (error) setFailed(true);
    else setDays(data ?? []);
  }, [couple]);

  useEffect(() => {
    load();
    if (!couple) return;
    return subscribeTable<StreakDayRow>('streak_days', couple.id, () => load());
  }, [couple, load]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!reduce) flame.value = withRepeat(withSequence(withTiming(1.08, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
  }, [flame, reduce]);
  const flameStyle = useAnimatedStyle(() => ({ transform: [{ scale: flame.value }] }));

  if (!couple) return null;
  const tz = couple.home_timezone;
  const freezes = freezesAvailable(couple.streak_freezes_left, couple.streak_freeze_month, tz, now);
  const st = streakStatus(couple.streak_count, couple.streak_last_day, tz, now, freezes);
  const level = coupleLevel(couple.couple_xp);
  const today = dayKey(now, tz);

  const applyFreeze = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await api.rpc('use_streak_freeze');
    setBusy(false);
    if (error) {
      haptic.error();
      setMsg(errorCode(error) === 'no_freezes_left' ? s.snaps.freezeNone : s.auth.errors.generic);
    } else {
      haptic.success();
      setMsg(s.snaps.freezeUsed);
    }
  };

  let statusText = '';
  let statusColor: string = colors.textMuted;
  if (st.state === 'done_today') {
    statusText = s.snaps.doneToday;
    statusColor = colors.success;
  } else if (st.state === 'pending_today') {
    const { h, m } = splitDuration(st.msLeft);
    statusText = `${st.atRisk ? s.streak.atRisk + '\n' : ''}${fmt(s.snaps.hoursLeft, { time: `${num(h)}:${num(String(m).padStart(2, '0'))}` })}`;
    statusColor = st.atRisk ? colors.warning : colors.textMuted;
  } else if (st.state === 'freezable') {
    statusText = s.streak.freezable;
    statusColor = colors.ice;
  } else if (st.state === 'broken') {
    statusText = s.streak.broken;
    statusColor = colors.danger;
  }

  const grid = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const byDay = new Map((days ?? []).map((d) => [d.day, d]));
  const mine = (d: StreakDayRow | undefined) => (d ? (role === 'a' ? d.a_sent : d.b_sent) : false);
  const theirs = (d: StreakDayRow | undefined) => (d ? (role === 'a' ? d.b_sent : d.a_sent) : false);
  const nextMilestone = MILESTONES.find((m) => m > st.count);

  return (
    <Screen scroll header={<Header title={s.snaps.streakTitle} />}>
      <Animated.View entering={ZoomIn.springify()} style={styles.hero}>
        <Animated.Text style={[styles.bigFlame, flameStyle]}>{st.state === 'freezable' ? '❄️' : st.count > 0 ? '🔥' : '🤍'}</Animated.Text>
        <Txt variant="hero" style={styles.count}>{num(st.count)}</Txt>
        <Txt muted>{s.streak.label}</Txt>
        {statusText ? <Txt center color={statusColor}>{statusText}</Txt> : null}
        <Txt variant="small" muted>{fmt(s.streak.best, { n: couple.streak_best })}</Txt>
      </Animated.View>

      {(st.state === 'freezable' || st.state === 'pending_today') && (
        <Animated.View entering={FadeInDown} style={styles.gap}>
          {st.state === 'freezable' && (
            <Button title={fmt(s.streak.useFreeze, { n: freezes })} onPress={applyFreeze} loading={busy} variant="glass" />
          )}
          {st.state === 'pending_today' && <Button title={s.snaps.sendSnapNow} onPress={() => router.back()} />}
        </Animated.View>
      )}
      {msg ? <Txt center muted>{msg}</Txt> : null}

      <Glass style={styles.gap}>
        <Txt variant="heading">{s.snaps.last14}</Txt>
        {failed ? (
          <ErrorState onRetry={load} />
        ) : !days ? (
          <Skeleton height={64} />
        ) : (
          <View style={styles.grid}>
            {grid.map((d) => {
              const row = byDay.get(d);
              const done = !!row?.completed;
              return (
                <View key={d} style={[styles.cell, done && styles.cellDone, row?.frozen && styles.cellFrozen, d === today && styles.cellToday]}>
                  <Txt variant="tiny">{row?.frozen ? '❄️' : done ? '🔥' : num(Number(d.slice(8)))}</Txt>
                  <View style={styles.dots}>
                    <View style={[styles.dot, mine(row) && styles.dotOn]} />
                    <View style={[styles.dot, theirs(row) && styles.dotOnPartner]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <View style={styles.legend}>
          <View style={[styles.dot, styles.dotOn]} /><Txt variant="tiny" muted>{s.snaps.youSent}</Txt>
          <View style={[styles.dot, styles.dotOnPartner]} /><Txt variant="tiny" muted>{s.snaps.partnerSent}</Txt>
        </View>
        <Txt variant="small" muted>{fmt(s.snaps.streakRule, { tz })}</Txt>
        <Txt variant="small" color={colors.ice}>{fmt(s.snaps.freezesLeft, { n: freezes })}</Txt>
      </Glass>

      <Glass style={styles.gap}>
        <Txt variant="heading">{s.snaps.milestones}</Txt>
        <View style={styles.milestones}>
          {MILESTONES.map((m) => (
            <View key={m} style={[styles.milestone, couple.streak_best >= m && styles.milestoneOn, m === nextMilestone && styles.milestoneNext]}>
              <Txt variant="small">{couple.streak_best >= m ? '🔥' : '🔒'} {num(m)}</Txt>
            </View>
          ))}
        </View>
      </Glass>

      <Glass style={styles.gap}>
        <Txt variant="heading">{s.snaps.miniStreaks}</Txt>
        <Txt>💬 {fmt(s.streak.questionStreak, { n: couple.question_streak })}</Txt>
        <Txt>🎲 {fmt(s.streak.gameStreak, { n: couple.game_streak })}</Txt>
      </Glass>

      <Glass style={styles.gap}>
        <Txt variant="heading">{fmt(s.snaps.level, { n: level.level })}</Txt>
        <View style={styles.bar}><View style={[styles.fill, { width: `${Math.round(level.progress * 100)}%` }]} /></View>
        <Txt variant="small" muted>{fmt(s.snaps.levelNext, { n: Math.max(0, level.nextAt - couple.couple_xp) })}</Txt>
      </Glass>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.xs, paddingVertical: space.lg },
  bigFlame: { fontSize: 88, lineHeight: 110 },
  count: { fontSize: 64, lineHeight: 80 },
  gap: { gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  cell: { width: 40, height: 52, borderRadius: radius.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 4 },
  cellDone: { backgroundColor: 'rgba(255,107,61,0.22)' },
  cellFrozen: { backgroundColor: 'rgba(143,211,255,0.2)' },
  cellToday: { borderWidth: 1.5, borderColor: colors.rose },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.surfaceStrong },
  dotOn: { backgroundColor: colors.rose },
  dotOnPartner: { backgroundColor: colors.coral },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  milestones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  milestone: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surface },
  milestoneOn: { backgroundColor: 'rgba(255,107,61,0.25)' },
  milestoneNext: { borderWidth: 1, borderColor: colors.rose },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceStrong, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.accent },
});
