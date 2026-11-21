import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { Pressy } from '@/components/Pressy';
import { Avatar } from '@/components/Avatar';
import { colors, radius, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { secureRandomInt } from '@/lib/crypto';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/lib/session';
import type { Heat } from '@/lib/database.types';
import { wyrPool } from '@/features/decks/pools';
import { textOf } from '@/features/decks/text';
import { wyrBothCommitted, wyrCommitPick, wyrDraw, wyrResult, wyrReveal, type WyrState } from '../logic';
import { HeatPicker } from '../ui/HeatPicker';
import { loadSecret, newSalt, saveSecret } from '../secrets';
import type { RoomProps } from './types';

type Secret = { pick: 'a' | 'b'; salt: string };

export function WouldYouRatherRoom({ sessionId, state, apply, me, partnerId, partnerName, locale, spicyActive, cards, readOnly }: RoomProps<WyrState>) {
  const s = useStrings();
  const { me: myProfile, partner } = useSession();
  const q = state.question;
  const slot = q ? `wyr.${state.round}.${q.id}` : '';
  const [mine, setMine] = useState<Secret | null>(null);
  const revealing = useRef(false);
  const maxHeat: Heat = spicyActive ? 4 : 2;

  useEffect(() => {
    setMine(null);
    if (slot) loadSecret<Secret>(sessionId, slot).then(setMine);
  }, [sessionId, slot]);

  // Auto-reveal once both picks are committed.
  useEffect(() => {
    if (!q || !mine || readOnly || revealing.current) return;
    if (wyrBothCommitted(state) && !state.reveals[me]) {
      revealing.current = true;
      apply((st) => wyrReveal(st, me, mine.pick, mine.salt)).finally(() => {
        revealing.current = false;
      });
    }
  }, [state, mine, q, me, apply, readOnly]);

  const choose = async (pick: 'a' | 'b') => {
    if (!q || state.commits[me]) return;
    const sec = { pick, salt: newSalt() };
    await saveSecret(sessionId, slot, sec);
    setMine(sec);
    haptic.send();
    apply((st) => wyrCommitPick(st, me, sec.pick, sec.salt));
  };

  const result = wyrResult(state);
  const iCommitted = !!state.commits[me];

  const Option = ({ side }: { side: 'a' | 'b' }) => {
    const chosenByMe = (result.complete ? result.picks[me] : mine?.pick) === side;
    const chosenByThem = result.complete && result.picks[partnerId] === side;
    return (
      <Pressy disabled={readOnly || iCommitted} onPress={() => choose(side)} style={[styles.opt, chosenByMe && styles.optMine]}>
        <Txt variant="heading" center>{q ? textOf(q[side], locale) : ''}</Txt>
        <View style={styles.who}>
          {chosenByMe && <Animated.View entering={ZoomIn}><Avatar profile={myProfile} size={26} /></Animated.View>}
          {chosenByThem && <Animated.View entering={ZoomIn.delay(150)}><Avatar profile={partner} size={26} /></Animated.View>}
        </View>
      </Pressy>
    );
  };

  return (
    <View style={styles.gap}>
      <Txt variant="small" muted center>{fmt(s.games.wyr.matches, { n: state.matches })}</Txt>
      <HeatPicker value={state.heat} maxHeat={maxHeat} disabled={readOnly || (!!q && !result.complete)} onChange={(h) => apply((st) => ({ ...st, heat: h }))} />
      {q ? (
        <View style={styles.gap}>
          <Txt variant="title" center>{s.games.wyr.title}</Txt>
          <Option side="a" />
          <Txt center muted>{s.games.wyr.or}</Txt>
          <Option side="b" />
          {!result.complete && !iCommitted && !readOnly && <Txt center muted>{s.games.wyr.pick}</Txt>}
          {!result.complete && iCommitted && (
            <Animated.View entering={FadeIn}>
              <Txt center>{s.games.wyr.locked}</Txt>
              {!state.commits[partnerId] && <Txt center muted variant="small">{fmt(s.games.wyr.waiting, { name: partnerName })}</Txt>}
            </Animated.View>
          )}
          {result.complete && (
            <Animated.View entering={ZoomIn.springify()}>
              <Txt variant="title" center color={result.match ? colors.rose : colors.text}>
                {!result.valid ? s.games.wyr.invalid : result.match ? s.games.wyr.match : s.games.wyr.differ}
              </Txt>
            </Animated.View>
          )}
        </View>
      ) : null}
      {!readOnly && (!q || result.complete) && (
        <Button title={s.games.wyr.draw} onPress={() => apply((st) => wyrDraw(st, wyrPool(cards, st.heat), secureRandomInt))} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  opt: { padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, minHeight: 96, justifyContent: 'center', gap: space.sm },
  optMine: { borderColor: colors.accent, backgroundColor: 'rgba(255,77,109,0.14)' },
  who: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, minHeight: 26 },
});
