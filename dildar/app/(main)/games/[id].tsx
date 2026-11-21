/**
 * Live game room. Compact, PiP/FaceTime-friendly layout: everything fits in
 * one scroll column so the call window can sit on top.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { ErrorState, Skeleton } from '@/components/States';
import { colors, radius, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { postMessage } from '@/lib/messages';
import { haptic } from '@/lib/haptics';
import type { GameType } from '@/lib/database.types';
import { useScreenGuard } from '@/features/security/useScreenGuard';
import { useDecks } from '@/features/decks/useDecks';
import { useGameRoom } from '@/features/games/engine';
import { SPICY_GAMES, type GameState } from '@/features/games/logic';
import { TruthDareRoom } from '@/features/games/rooms/TruthDareRoom';
import { DiceRoom } from '@/features/games/rooms/DiceRoom';
import { WouldYouRatherRoom } from '@/features/games/rooms/WouldYouRatherRoom';
import { StripRoom } from '@/features/games/rooms/StripRoom';
import { RoleplayRoom } from '@/features/games/rooms/RoleplayRoom';
import { TeaseRoom } from '@/features/games/rooms/TeaseRoom';
import { KnowMeRoom } from '@/features/games/rooms/KnowMeRoom';
import type { RoomProps } from '@/features/games/rooms/types';

export default function GameRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useStrings();
  const { locale } = useSettings();
  const { userId, partner, couple, sharedKey, spicyActive } = useSession();
  const room = useGameRoom(id);
  const { cards, decks } = useDecks({ refreshOnFocus: true });
  const joined = useRef(false);
  const gameType = room.row?.game_type as GameType | undefined;
  const isSpicy = !!gameType && SPICY_GAMES.includes(gameType);
  useScreenGuard('game', id, isSpicy);

  // The invited partner opening the room flips it to "active".
  useEffect(() => {
    if (joined.current || !room.row || !room.state || !userId) return;
    if (room.status === 'invited' && room.row.created_by !== userId) {
      joined.current = true;
      haptic.success();
      room.apply((st) => st, { status: 'active' });
    }
  }, [room, userId]);

  const apply = useCallback(<S extends GameState>(m: (s: S) => S) => room.apply((st) => m(st as S)), [room]);

  const finish = () =>
    Alert.alert(s.games.finish, s.games.finishConfirm, [
      { text: s.common.cancel, style: 'cancel' },
      {
        text: s.games.finish,
        style: 'destructive',
        onPress: async () => {
          const st = room.state;
          const ok = await room.apply((x) => x, { status: 'finished' });
          if (ok && st && couple && userId && sharedKey && gameType) {
            const meScore = st.scores[userId] ?? 0;
            const themScore = partner ? st.scores[partner.user_id] ?? 0 : 0;
            await postMessage({
              coupleId: couple.id,
              senderId: userId,
              key: sharedKey,
              type: 'game_result',
              body: { t: 'game_result', game: gameType, summary: fmt(s.games.resultSummary, { game: s.games.names[gameType], me: meScore, them: themScore }), sessionId: id },
              meta: { game_session: id },
            });
          }
          haptic.success();
          router.back();
        },
      },
    ]);

  if (room.loading) {
    return (
      <Screen header={<Header title={s.games.title} />}>
        <View style={styles.pad}>
          <Skeleton height={40} />
          <Skeleton height={280} />
          <Skeleton height={54} />
        </View>
      </Screen>
    );
  }
  if (room.error === 'not_found' || !room.row || !gameType) {
    return (
      <Screen header={<Header title={s.games.title} />}>
        <ErrorState message={s.games.notFound} onRetry={room.reload} />
      </Screen>
    );
  }
  if (!room.state || !userId || !partner) {
    return (
      <Screen header={<Header title={s.games.names[gameType]} />}>
        <ErrorState message={s.states.decryptFailed} onRetry={room.reload} />
      </Screen>
    );
  }

  const readOnly = room.status === 'finished' || room.status === 'cancelled' || (isSpicy && !spicyActive);
  const base = {
    sessionId: id,
    me: userId,
    partnerId: partner.user_id,
    partnerName: partner.display_name || s.common.partner,
    locale,
    spicyActive,
    cards,
    decks,
    readOnly,
  };
  const st = room.state;
  const props = <S extends GameState>(state: S): RoomProps<S> => ({ ...base, state, apply: apply as RoomProps<S>['apply'] });

  return (
    <Screen
      header={
        <Header
          title={s.games.names[gameType]}
          right={<View style={[styles.dot, { backgroundColor: room.partnerHere ? colors.success : colors.textFaint }]} />}
        />
      }
    >
      <KeyboardAwareScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        <View style={styles.status}>
          <Txt variant="tiny" muted>
            {room.partnerHere ? fmt(s.games.partnerHere, { name: base.partnerName }) : fmt(s.games.partnerAway, { name: base.partnerName })}
          </Txt>
          {room.syncing ? <Txt variant="tiny" muted>{s.games.syncing}</Txt> : null}
          {readOnly ? <Txt variant="tiny" color={colors.rose}>{room.status === 'cancelled' ? s.games.cancelled : s.games.finished}</Txt> : null}
        </View>
        {st.game === 'truth_dare' && <TruthDareRoom {...props(st)} />}
        {st.game === 'dice' && <DiceRoom {...props(st)} />}
        {st.game === 'would_you_rather' && <WouldYouRatherRoom {...props(st)} />}
        {st.game === 'strip' && <StripRoom {...props(st)} />}
        {st.game === 'roleplay' && <RoleplayRoom {...props(st)} />}
        {st.game === 'tease_timer' && <TeaseRoom {...props(st)} />}
        {st.game === 'know_me' && <KnowMeRoom {...props(st)} />}
        {!readOnly && <Button title={s.games.finish} variant="ghost" small onPress={finish} style={styles.finish} />}
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  dot: { width: 12, height: 12, borderRadius: radius.pill, marginEnd: space.sm },
  status: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  finish: { marginTop: space.lg },
});
