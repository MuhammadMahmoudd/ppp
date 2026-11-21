import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { Glass } from '@/components/Glass';
import { Txt } from '@/components/Txt';
import { colors, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { secureRandomInt } from '@/lib/crypto';
import { haptic } from '@/lib/haptics';
import { poolFor } from '@/features/decks/pools';
import { textOf, type Txt as CardTxt } from '@/features/decks/text';
import { roleplayCommitGoal, roleplayDeal, roleplayRevealGoal, type RoleplayState } from '../logic';
import { loadSecret, newSalt, saveSecret } from '../secrets';
import type { RoomProps } from './types';

type Secret = { goal: CardTxt; salt: string };

export function RoleplayRoom({ sessionId, state, apply, me, partnerId, partnerName, locale, cards, readOnly }: RoomProps<RoleplayState>) {
  const s = useStrings();
  const slot = `rp.${state.round}`;
  const [mine, setMine] = useState<Secret | null>(null);
  const settings = poolFor('roleplay_setting', cards);
  const characters = poolFor('roleplay_character', cards);
  const goals = poolFor('roleplay_goal', cards);

  useEffect(() => {
    setMine(null);
    loadSecret<Secret>(sessionId, slot).then(setMine);
  }, [sessionId, slot]);

  const drawGoal = async () => {
    const g = goals[secureRandomInt(goals.length)];
    if (!g) return;
    const sec = { goal: g.text, salt: newSalt() };
    await saveSecret(sessionId, slot, sec);
    setMine(sec);
    haptic.success();
    apply((st) => roleplayCommitGoal(st, me, sec.goal, sec.salt));
  };

  const reveal = () => {
    if (mine) apply((st) => roleplayRevealGoal(st, me, mine.goal, mine.salt));
  };

  const dealt = !!state.setting;
  return (
    <View style={styles.gap}>
      {dealt ? (
        <Animated.View entering={FadeInDown.springify()} style={styles.gap}>
          <Glass style={styles.card}>
            <Txt variant="tiny" muted>{s.games.roleplay.setting}</Txt>
            <Txt variant="title">{textOf(state.setting, locale)}</Txt>
          </Glass>
          <View style={styles.row}>
            <Glass style={[styles.card, styles.flex]}>
              <Txt variant="tiny" muted>{s.games.roleplay.yourCharacter}</Txt>
              <Txt variant="heading">{textOf(state.characters[me], locale)}</Txt>
            </Glass>
            <Glass style={[styles.card, styles.flex]}>
              <Txt variant="tiny" muted>{fmt(s.games.roleplay.theirCharacter, { name: partnerName })}</Txt>
              <Txt variant="heading">{textOf(state.characters[partnerId], locale)}</Txt>
            </Glass>
          </View>
          <Glass style={[styles.card, styles.secret]}>
            <Txt variant="tiny" color={colors.rose}>{s.games.roleplay.yourGoal}</Txt>
            {mine && state.goalCommits[me] ? (
              <Txt variant="heading">{textOf(mine.goal, locale)}</Txt>
            ) : (
              !readOnly && <Button title={s.games.roleplay.drawGoal} onPress={drawGoal} small disabled={!goals.length} />
            )}
          </Glass>
          {state.goalCommits[partnerId] && !state.goalReveals[partnerId] && <Txt center muted>{fmt(s.games.roleplay.goalHidden, { name: partnerName })}</Txt>}
          {state.goalReveals[partnerId] && (
            <Glass style={styles.card}>
              <Txt variant="tiny" muted>{fmt(s.games.roleplay.theirGoal, { name: partnerName })}</Txt>
              <Txt variant="heading">{textOf(state.goalReveals[partnerId].goal, locale)}</Txt>
            </Glass>
          )}
          {!readOnly && mine && state.goalCommits[me] && !state.goalReveals[me] && <Button title={s.games.roleplay.reveal} onPress={reveal} variant="glass" />}
        </Animated.View>
      ) : (
        <Txt muted center>🎬</Txt>
      )}
      {!readOnly && (settings.length && characters.length ? (
        <Button title={s.games.roleplay.deal} onPress={() => { haptic.tap(); apply((st) => roleplayDeal(st, settings, characters, secureRandomInt)); }} variant={dealt ? 'ghost' : 'primary'} />
      ) : (
        <Txt muted center>{s.games.roleplay.needPools}</Txt>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  card: { gap: space.xs },
  secret: { borderColor: colors.accent, borderWidth: 1 },
});
