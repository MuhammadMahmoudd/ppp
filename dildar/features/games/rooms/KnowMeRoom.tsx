import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { Glass } from '@/components/Glass';
import { Input } from '@/components/Input';
import { Txt } from '@/components/Txt';
import { colors, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { secureRandomInt } from '@/lib/crypto';
import { haptic } from '@/lib/haptics';
import { knowMePool } from '@/features/decks/pools';
import { knowAsk, knowGuess, knowJudge, knowNext, type KnowMeState } from '../logic';
import { Scoreboard } from '../ui/Scoreboard';
import type { RoomProps } from './types';

export function KnowMeRoom({ state, apply, me, partnerName, cards, readOnly }: RoomProps<KnowMeState>) {
  const s = useStrings();
  const [guess, setGuess] = useState('');
  const mineQs = knowMePool(cards, me);
  const iAmSubject = state.subject === me;
  const myAnswer = state.question ? mineQs.find((q) => q.id === state.question?.id)?.answer ?? null : null;

  const draw = () => {
    const fresh = mineQs.filter((q) => q.id !== state.question?.id);
    const q = (fresh.length ? fresh : mineQs)[secureRandomInt((fresh.length ? fresh : mineQs).length)];
    if (q) apply((st) => knowAsk(st, me, { id: q.id, text: q.question }));
  };

  return (
    <View style={styles.gap}>
      <Scoreboard scores={state.scores} turn={state.subject} round={state.round} />
      <Txt center muted>{iAmSubject ? s.games.knowMe.subjectYou : fmt(s.games.knowMe.subjectThem, { name: partnerName })}</Txt>

      {state.question && (
        <Glass style={styles.q}>
          <Txt variant="title" center>{state.question.text}</Txt>
        </Glass>
      )}

      {!state.question && iAmSubject && !readOnly && (
        mineQs.length ? (
          <Button title={s.games.knowMe.draw} onPress={draw} />
        ) : (
          <View style={styles.gap}>
            <Txt muted center>{s.games.knowMe.noCards}</Txt>
            <Button title={s.games.knowMe.writeSome} variant="glass" onPress={() => router.push('/decks' as never)} />
          </View>
        )
      )}
      {!state.question && !iAmSubject && <Txt muted center>{fmt(s.games.knowMe.waitingQuestion, { name: partnerName })}</Txt>}

      {state.question && state.guess == null && !iAmSubject && !readOnly && (
        <View style={styles.gap}>
          <Input value={guess} onChangeText={setGuess} placeholder={s.games.knowMe.guess} />
          <Button title={s.games.knowMe.send} disabled={!guess.trim()} onPress={() => { haptic.send(); apply((st) => knowGuess(st, guess)); setGuess(''); }} />
        </View>
      )}
      {state.question && state.guess == null && iAmSubject && <Txt muted center>{fmt(s.games.strip.waitingGuess, { name: partnerName })}</Txt>}

      {state.guess != null && (
        <View style={styles.gap}>
          <Txt variant="heading" center>{fmt(s.games.knowMe.theirGuess, { name: iAmSubject ? partnerName : s.common.you, guess: state.guess })}</Txt>
          {iAmSubject && myAnswer && !state.verdict && <Txt center muted>{fmt(s.games.knowMe.correctAnswer, { answer: myAnswer })}</Txt>}
          {iAmSubject && !state.verdict && !readOnly && (
            <View style={styles.row}>
              <Button title={s.games.knowMe.right} onPress={() => { haptic.success(); apply((st) => knowJudge(st, true, myAnswer ?? '')); }} style={styles.flex} />
              <Button title={s.games.knowMe.wrong} onPress={() => apply((st) => knowJudge(st, false, myAnswer ?? ''))} style={styles.flex} variant="glass" />
            </View>
          )}
          {!iAmSubject && !state.verdict && <Txt muted center>{fmt(s.games.strip.waitingJudge, { name: partnerName })}</Txt>}
          {state.verdict && (
            <Animated.View entering={ZoomIn.springify()} style={styles.gap}>
              <Txt variant="title" center color={state.verdict === 'right' ? colors.success : colors.rose}>
                {state.verdict === 'right' ? s.games.knowMe.right : s.games.knowMe.wrong}
              </Txt>
              {state.answer ? <Txt center muted>{fmt(s.games.knowMe.correctAnswer, { answer: state.answer })}</Txt> : null}
              {!readOnly && <Button title={s.games.next} onPress={() => apply((st) => knowNext(st))} />}
            </Animated.View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  q: { minHeight: 120, justifyContent: 'center' },
});
