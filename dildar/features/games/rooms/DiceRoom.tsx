import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { Pressy } from '@/components/Pressy';
import { colors, radius, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { secureRandomInt } from '@/lib/crypto';
import { haptic } from '@/lib/haptics';
import { diceDefs, type DieDef } from '@/features/decks/pools';
import { textOf } from '@/features/decks/text';
import { diceRoll, diceSetDice, type DiceState } from '../logic';
import { DieView } from '../ui/DieView';
import type { RoomProps } from './types';

export function DiceRoom({ state, apply, me, partnerName, locale, cards, decks, readOnly }: RoomProps<DiceState>) {
  const s = useStrings();
  const defs = useMemo(() => diceDefs(cards, new Map(decks.map((d) => [d.id, d.name]))), [cards, decks]);
  const [editing, setEditing] = useState(state.dice.length < 2);
  const [chosen, setChosen] = useState<string[]>([]);
  const lastSeq = useRef(state.roll?.seq ?? 0);

  // rigid haptic on every roll — ours or theirs
  useEffect(() => {
    const seq = state.roll?.seq ?? 0;
    if (seq && seq !== lastSeq.current) haptic.rigid();
    lastSeq.current = seq;
  }, [state.roll?.seq]);

  const toggle = (id: string) => {
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 4 ? c : [...c, id]));
  };
  const saveDice = () => {
    const sel = chosen.map((id) => defs.find((d) => d.id === id)).filter((d): d is DieDef => !!d);
    if (sel.length < 2) return;
    apply((st) => diceSetDice(st, sel));
    setEditing(false);
  };

  if (editing && !readOnly) {
    return (
      <View style={styles.gap}>
        <Txt variant="heading">{s.games.dice.choose}</Txt>
        <View style={styles.wrap}>
          {defs.map((d) => {
            const on = chosen.includes(d.id);
            return (
              <Pressy key={d.id} hapticStyle="select" onPress={() => toggle(d.id)} style={[styles.chip, on && styles.chipOn]}>
                <Txt variant="small">{textOf(d.name, locale)}</Txt>
                <Txt variant="tiny" muted numberOfLines={1}>{d.faces.slice(0, 3).map((f) => textOf(f, locale)).join(' · ')}…</Txt>
              </Pressy>
            );
          })}
        </View>
        {chosen.length < 2 && <Txt variant="small" muted>{s.games.dice.needTwo}</Txt>}
        <Button title={s.common.done} onPress={saveDice} disabled={chosen.length < 2} />
        <Button title={s.games.dice.edit} variant="ghost" small onPress={() => router.push('/decks' as never)} icon={<Ionicons name="create-outline" size={16} color={colors.rose} />} />
      </View>
    );
  }

  const roll = state.roll;
  return (
    <View style={styles.gap}>
      <View style={styles.dice}>
        {state.dice.map((d, i) => (
          <DieView key={i} label={textOf(d.name, locale)} face={roll ? textOf(d.faces[roll.results[i]], locale) : '?'} seq={roll?.seq ?? 0} />
        ))}
      </View>
      {roll && <Txt muted center variant="small">{fmt(s.games.dice.rolledBy, { name: roll.by === me ? s.common.you : partnerName })}</Txt>}
      {!readOnly && (
        <>
          <Button title={s.games.dice.roll} onPress={() => apply((st) => diceRoll(st, me, secureRandomInt))} icon={<Ionicons name="dice" size={20} color={colors.text} />} />
          <Button title={s.games.dice.choose} variant="ghost" small onPress={() => { setChosen([]); setEditing(true); }} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  dice: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.md, paddingVertical: space.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { width: '48%', padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 2 },
  chipOn: { borderColor: colors.accent, backgroundColor: 'rgba(255,77,109,0.15)' },
});
