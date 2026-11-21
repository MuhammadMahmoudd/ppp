import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { Glass } from '@/components/Glass';
import { HeatBadge } from '@/components/HeatBadge';
import { colors, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { secureRandomInt } from '@/lib/crypto';
import { haptic } from '@/lib/haptics';
import type { Heat } from '@/lib/database.types';
import { poolFor } from '@/features/decks/pools';
import { textOf } from '@/features/decks/text';
import { teaseNext, teaseStart, type TeaseState } from '../logic';
import { Countdown } from '../ui/Countdown';
import { Scoreboard } from '../ui/Scoreboard';
import type { RoomProps } from './types';

export function TeaseRoom({ state, apply, me, partnerName, locale, cards, readOnly }: RoomProps<TeaseState>) {
  const s = useStrings();
  const [ended, setEnded] = useState<string | null>(null);
  const hasFiery = cards.some((c) => c.kind === 'tease' && c.heat === 4);
  const maxHeat: Heat = hasFiery ? 4 : 3;
  const prompts = (h: Heat) => {
    for (let x = h; x >= 1; x--) {
      const p = poolFor('tease', cards, { heat: x as Heat });
      if (p.length) return p;
    }
    return [];
  };
  const running = !!state.endsAt && new Date(state.endsAt).getTime() > Date.now() && ended !== state.endsAt;

  return (
    <View style={styles.gap}>
      <Scoreboard scores={state.scores} turn={state.leader} round={state.round} />
      {state.leader ? (
        <Animated.View key={state.round} entering={ZoomIn.springify()} style={styles.gap}>
          <Txt variant="title" center color={state.leader === me ? colors.rose : colors.text}>
            {state.leader === me ? s.games.tease.youLead : fmt(s.games.tease.leader, { name: partnerName })}
          </Txt>
          <View style={styles.center}><HeatBadge heat={state.heat} /></View>
          {state.prompt && (
            <Glass style={styles.prompt}>
              <Txt variant="tiny" muted>{s.games.tease.prompt}</Txt>
              <Txt variant="heading" center>{textOf(state.prompt, locale)}</Txt>
            </Glass>
          )}
          <Txt center muted>{fmt(s.games.tease.duration, { n: state.durationSec })}</Txt>
          {state.endsAt && <Countdown endsAt={state.endsAt} big onEnd={() => setEnded(state.endsAt)} />}
          {state.endsAt && ended === state.endsAt && <Txt variant="heading" center color={colors.rose}>{s.games.tease.timeUp}</Txt>}
          {!readOnly && !state.endsAt && <Button title={s.games.tease.start} onPress={() => { haptic.heavy(); apply((st) => teaseStart(st)); }} />}
        </Animated.View>
      ) : (
        <Txt style={styles.emoji} center>⏱️</Txt>
      )}
      {!readOnly && !running && (
        <Button title={s.games.tease.nextRound} variant={state.leader ? 'glass' : 'primary'} onPress={() => { haptic.rigid(); apply((st) => teaseNext(st, prompts, maxHeat, secureRandomInt)); }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  center: { alignItems: 'center' },
  prompt: { gap: space.xs, alignItems: 'center' },
  emoji: { fontSize: 64, lineHeight: 80 },
});
