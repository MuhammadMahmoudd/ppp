import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { colors, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { secureRandomInt } from '@/lib/crypto';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/lib/session';
import type { Heat } from '@/lib/database.types';
import { poolFor } from '@/features/decks/pools';
import { textOf } from '@/features/decks/text';
import { todDraw, todResolve, todSetHeat, type TodState } from '../logic';
import { sendDare } from '../dares';
import { FlipCard } from '../ui/FlipCard';
import { HeatPicker } from '../ui/HeatPicker';
import { Scoreboard, TurnPill } from '../ui/Scoreboard';
import type { RoomProps } from './types';

export function TruthDareRoom({ state, apply, me, partnerName, locale, spicyActive, cards, readOnly }: RoomProps<TodState>) {
  const s = useStrings();
  const { couple, sharedKey } = useSession();
  const [sent, setSent] = useState(false);
  const myTurn = state.turn === me;
  const maxHeat: Heat = spicyActive ? 4 : 2;
  const pool = (kind: 'truth' | 'dare') => poolFor(kind, cards, { heat: state.heat });
  const cur = state.current;

  const draw = (kind: 'truth' | 'dare') => {
    haptic.tap();
    apply((st) => todDraw(st, kind, pool(kind), secureRandomInt));
  };

  const asDare = async () => {
    if (!cur || !couple || !sharedKey) return;
    await sendDare({ coupleId: couple.id, me, key: sharedKey, text: textOf(cur.card.text, locale), heat: cur.card.heat, proof: null, deadlineMs: 24 * 3600_000 });
    setSent(true);
    haptic.success();
    apply((st) => todResolve(st, false));
  };

  return (
    <View style={styles.gap}>
      <Scoreboard scores={state.scores} turn={state.turn} round={state.round} />
      <TurnPill mine={myTurn} name={partnerName} />
      <HeatPicker value={state.heat} maxHeat={maxHeat} disabled={readOnly || !!cur} onChange={(h) => apply((st) => todSetHeat(st, h))} />
      {state.heat === 4 && <Txt variant="small" muted center>{s.games.tod.level4Note}</Txt>}

      <FlipCard
        faceKey={cur ? `${cur.card.id}:${state.round}` : null}
        title={cur ? (cur.kind === 'truth' ? s.games.tod.truth : s.games.tod.dare) : undefined}
        body={cur ? textOf(cur.card.text, locale) : undefined}
        heat={cur?.card.heat ?? state.heat}
        emoji="🎭"
      />

      {!readOnly && !cur && myTurn && (
        pool('truth').length + pool('dare').length === 0 ? (
          <Txt muted center>{s.games.tod.empty}</Txt>
        ) : (
          <View style={styles.row}>
            <Button title={s.games.tod.truth} onPress={() => draw('truth')} style={styles.flex} disabled={!pool('truth').length} />
            <Button title={s.games.tod.dare} onPress={() => draw('dare')} style={styles.flex} variant="glass" disabled={!pool('dare').length} />
          </View>
        )
      )}
      {!readOnly && !cur && !myTurn && <Txt muted center>{fmt(s.games.waitingPartner, { name: partnerName })}</Txt>}

      {!readOnly && cur && (
        <View style={styles.gap}>
          <View style={styles.row}>
            <Button title={s.games.tod.done} onPress={() => { haptic.success(); apply((st) => todResolve(st, true)); }} style={styles.flex} />
            <Button title={s.games.tod.skip} onPress={() => apply((st) => todResolve(st, false))} style={styles.flex} variant="glass" />
          </View>
          {cur.kind === 'dare' && !sent && <Button title={s.games.tod.sendAsDare} onPress={asDare} variant="ghost" small />}
        </View>
      )}
      {sent && <Txt variant="small" color={colors.success} center>{s.games.dares.sent}</Txt>}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
