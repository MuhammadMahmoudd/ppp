import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Txt } from '@/components/Txt';
import { colors, radius, space } from '@/lib/theme';
import { fmt, num, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';

/** Compact header row: both avatars + scores, highlights whose turn it is. */
export function Scoreboard({ scores, turn, round, label }: { scores: Record<string, number>; turn?: string | null; round?: number; label?: string }) {
  const s = useStrings();
  const { me, partner, userId } = useSession();
  const pid = partner?.user_id ?? '';
  const Side = ({ uid, profile }: { uid: string; profile: typeof me }) => (
    <View style={[styles.side, turn === uid && styles.turn]}>
      <Avatar profile={profile} size={30} />
      <Txt variant="heading">{num(scores[uid] ?? 0)}</Txt>
    </View>
  );
  return (
    <View style={styles.row}>
      <Side uid={userId ?? ''} profile={me} />
      <View style={styles.mid}>
        {round ? <Txt variant="tiny" muted>{fmt(s.games.round, { n: round })}</Txt> : null}
        {label ? <Txt variant="tiny" muted>{label}</Txt> : null}
      </View>
      <Side uid={pid} profile={partner} />
    </View>
  );
}

export function TurnPill({ mine, name }: { mine: boolean; name: string }) {
  const s = useStrings();
  return (
    <View style={[styles.pill, mine && styles.pillMine]}>
      <Txt variant="small">{mine ? s.games.yourTurn : fmt(s.games.theirTurn, { name })}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: 'transparent' },
  turn: { borderColor: colors.accent, backgroundColor: 'rgba(255,77,109,0.12)' },
  mid: { alignItems: 'center' },
  pill: { alignSelf: 'center', paddingHorizontal: space.lg, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface },
  pillMine: { backgroundColor: colors.accent },
});
