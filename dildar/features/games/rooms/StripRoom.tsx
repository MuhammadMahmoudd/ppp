import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Txt } from '@/components/Txt';
import { colors, radius, space } from '@/lib/theme';
import { fmt, num, useStrings } from '@/lib/i18n';
import { secureRandomInt } from '@/lib/crypto';
import { haptic } from '@/lib/haptics';
import type { Heat } from '@/lib/database.types';
import { knowMePool, poolFor } from '@/features/decks/pools';
import { textOf } from '@/features/decks/text';
import { stripAsk, stripDeal, stripForfeit, stripGuess, stripJudge, stripSetHeat, stripSetMode, type StripState } from '../logic';
import { FlipCard } from '../ui/FlipCard';
import { HeatPicker } from '../ui/HeatPicker';
import { Scoreboard } from '../ui/Scoreboard';
import { Segmented } from '../ui/Segmented';
import type { RoomProps } from './types';

const CARD_FACE = (v: number) => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[v] ?? String(v);

export function StripRoom({ state, apply, me, partnerId, partnerName, locale, cards, readOnly }: RoomProps<StripState>) {
  const s = useStrings();
  const [guess, setGuess] = useState('');
  const [myAnswer, setMyAnswer] = useState<string | null>(null);
  const myQuestions = knowMePool(cards, me);
  const forfeitPool = poolFor('forfeit', cards, { maxHeat: state.heat });
  const nameOf = (uid: string) => (uid === me ? s.common.you : partnerName);
  const canStart = state.phase === 'idle' || state.phase === 'lost' || state.phase === 'dealt';

  const ask = () => {
    const q = myQuestions[secureRandomInt(myQuestions.length)];
    if (!q) return;
    setMyAnswer(q.answer);
    apply((st) => stripAsk(st, me, q.question));
  };

  return (
    <View style={styles.gap}>
      <Scoreboard scores={state.scores} round={state.round} label={s.games.strip.losses.replace('{n}', '').replace(':', '').trim()} />
      <Segmented
        value={state.mode}
        disabled={readOnly || !canStart}
        options={[{ value: 'higher', label: s.games.strip.higher }, { value: 'quiz', label: s.games.strip.quiz }]}
        onChange={(m) => apply((st) => stripSetMode(st, m))}
      />
      <HeatPicker value={state.heat} disabled={readOnly} onChange={(h: Heat) => apply((st) => stripSetHeat(st, h))} />

      {state.mode === 'higher' && state.cards && (
        <View style={styles.cards}>
          {[me, partnerId].map((uid) => (
            <Animated.View key={`${uid}${state.round}`} entering={ZoomIn.springify()} style={[styles.playing, state.loser === uid && styles.lost]}>
              <Txt style={styles.face}>{CARD_FACE(state.cards?.[uid] ?? 0)}</Txt>
              <Txt variant="small" muted>{nameOf(uid)}</Txt>
            </Animated.View>
          ))}
        </View>
      )}
      {state.mode === 'higher' && state.phase === 'dealt' && !state.loser && <Txt center>{s.games.strip.tie}</Txt>}

      {state.mode === 'quiz' && state.quiz && (
        <View style={styles.quiz}>
          <Txt variant="heading" center>{state.quiz.question}</Txt>
          {state.phase === 'quiz_asked' && state.quiz.subject !== me && !readOnly && (
            <>
              <Input value={guess} onChangeText={setGuess} placeholder={s.games.strip.quizGuess} />
              <Button title={s.games.knowMe.send} disabled={!guess.trim()} onPress={() => { apply((st) => stripGuess(st, guess.trim())); setGuess(''); }} />
            </>
          )}
          {state.phase === 'quiz_asked' && state.quiz.subject === me && <Txt muted center>{fmt(s.games.strip.waitingGuess, { name: partnerName })}</Txt>}
          {state.phase === 'quiz_answered' && (
            <>
              <Txt center>{fmt(s.games.knowMe.theirGuess, { name: nameOf(otherOf(state, state.quiz.subject)), guess: state.quiz.guess ?? '' })}</Txt>
              {state.quiz.subject === me && myAnswer && <Txt center muted>{fmt(s.games.knowMe.correctAnswer, { answer: myAnswer })}</Txt>}
              {state.quiz.subject === me && !readOnly ? (
                <View style={styles.row}>
                  <Button title={s.games.strip.right} onPress={() => apply((st) => stripJudge(st, true))} style={styles.flex} />
                  <Button title={s.games.strip.wrong} onPress={() => apply((st) => stripJudge(st, false))} style={styles.flex} variant="glass" />
                </View>
              ) : (
                state.quiz.subject !== me && <Txt muted center>{fmt(s.games.strip.waitingJudge, { name: partnerName })}</Txt>
              )}
            </>
          )}
        </View>
      )}

      {state.phase === 'lost' && state.loser && (
        <Animated.View entering={ZoomIn} style={styles.gap}>
          <Txt variant="title" center color={colors.rose}>{state.loser === me ? s.games.strip.youLost : fmt(s.games.strip.loser, { name: partnerName })}</Txt>
          <FlipCard faceKey={state.forfeit ? `${state.forfeit.id}:${state.round}` : null} title={s.games.strip.forfeit} body={textOf(state.forfeit?.text, locale)} heat={state.forfeit?.heat ?? state.heat} emoji="🃏" />
          {!state.forfeit && state.loser === me && !readOnly && (
            <Button title={s.games.strip.drawForfeit} onPress={() => { haptic.heavy(); apply((st) => stripForfeit(st, forfeitPool, secureRandomInt)); }} disabled={!forfeitPool.length} />
          )}
        </Animated.View>
      )}

      {!readOnly && canStart && state.mode === 'higher' && (
        <Button title={s.games.strip.deal} onPress={() => { haptic.rigid(); apply((st) => stripDeal(st, secureRandomInt)); }} />
      )}
      {!readOnly && canStart && state.mode === 'quiz' && (
        myQuestions.length ? <Button title={s.games.strip.quizAsk} onPress={ask} /> : <Txt muted center variant="small">{s.games.strip.quizNoCards}</Txt>
      )}
      <Txt variant="tiny" muted center>{`${s.common.you}: ${num(state.scores[me] ?? 0)} · ${partnerName}: ${num(state.scores[partnerId] ?? 0)}`}</Txt>
    </View>
  );
}

function otherOf(s: StripState, uid: string) {
  return s.players.a === uid ? s.players.b : s.players.a;
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  cards: { flexDirection: 'row', justifyContent: 'center', gap: space.xl },
  playing: { width: 110, height: 150, borderRadius: radius.lg, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center', gap: 4 },
  lost: { borderWidth: 3, borderColor: colors.accent },
  face: { fontSize: 52, lineHeight: 64, color: colors.deepRed, fontFamily: 'Vazirmatn_800ExtraBold' },
  quiz: { gap: space.md, padding: space.lg, borderRadius: radius.xl, backgroundColor: colors.surface },
});
