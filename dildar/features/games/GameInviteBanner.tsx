/**
 * In-app game invite. Mount once on the home screen (above the pager).
 * Shows when the partner starts a game: via instant broadcast, or the
 * game_sessions INSERT if the broadcast was missed.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Glass } from '@/components/Glass';
import { Txt } from '@/components/Txt';
import { space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { onBroadcast, subscribeTable } from '@/lib/realtime';
import { haptic } from '@/lib/haptics';
import type { GameSessionRow, GameType } from '@/lib/database.types';
import { GAME_EMOJI } from './logic';

type Invite = { id: string; game: GameType };
const GAME_TYPES: GameType[] = ['truth_dare', 'dice', 'would_you_rather', 'strip', 'roleplay', 'tease_timer', 'know_me'];

export function GameInviteBanner() {
  const s = useStrings();
  const insets = useSafeAreaInsets();
  const { couple, userId, partner } = useSession();
  const [invite, setInvite] = useState<Invite | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const show = (inv: Invite) => {
      if (seen.current.has(inv.id)) return;
      seen.current.add(inv.id);
      haptic.warning();
      setInvite(inv);
    };
    const off = onBroadcast('game:invite', (p) => {
      const game = p.game as GameType;
      if (typeof p.id === 'string' && GAME_TYPES.includes(game)) show({ id: p.id, game });
    });
    const offDb = couple
      ? subscribeTable<GameSessionRow>('game_sessions', couple.id, (c) => {
          const r = c.new as GameSessionRow | undefined;
          if (c.eventType === 'INSERT' && r && r.created_by !== userId && r.status === 'invited') show({ id: r.id, game: r.game_type });
        })
      : () => undefined;
    return () => {
      off();
      offDb();
    };
  }, [couple, userId]);

  useEffect(() => {
    if (!invite) return;
    const t = setTimeout(() => setInvite(null), 30_000);
    return () => clearTimeout(t);
  }, [invite]);

  if (!invite) return null;
  return (
    <Animated.View entering={SlideInUp.springify()} exiting={SlideOutUp} style={[styles.wrap, { top: insets.top + 60 }]}>
      <Glass style={styles.card} intensity={60}>
        <View style={styles.row}>
          <Txt style={styles.emoji}>{GAME_EMOJI[invite.game]}</Txt>
          <View style={styles.flex}>
            <Txt variant="heading">{fmt(s.games.invite.title, { name: partner?.display_name || s.common.partner })}</Txt>
            <Txt variant="small" muted>{s.games.names[invite.game]}</Txt>
          </View>
        </View>
        <View style={styles.row}>
          <Button title={s.games.invite.join} small style={styles.flex} onPress={() => { const id = invite.id; setInvite(null); router.push(`/games/${id}` as never); }} />
          <Button title={s.games.invite.later} small variant="glass" style={styles.flex} onPress={() => setInvite(null)} />
        </View>
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: space.lg, end: space.lg, zIndex: 80 },
  card: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  emoji: { fontSize: 32, lineHeight: 42 },
});
