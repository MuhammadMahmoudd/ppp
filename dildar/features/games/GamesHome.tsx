import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Glass } from '@/components/Glass';
import { Pressy } from '@/components/Pressy';
import { Txt } from '@/components/Txt';
import { ErrorState, Skeleton } from '@/components/States';
import { colors, gradients, radius, space } from '@/lib/theme';
import { fmt, relativeTime, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { haptic } from '@/lib/haptics';
import { errorCode } from '@/lib/api';
import type { GameStatus, GameType } from '@/lib/database.types';
import { useChromeInsets } from '@/features/home/chrome';
import { useDecks } from '@/features/decks/useDecks';
import { diceDefs } from '@/features/decks/pools';
import { GAME_EMOJI, GAME_ORDER, SPICY_GAMES } from './logic';
import { startGame } from './api';
import { fetchDares, isOpen } from './dares';
import { useGameSessions } from './useSessions';

export function GamesHome({ active }: { active: boolean }) {
  const s = useStrings();
  const { top, bottom } = useChromeInsets();
  const { couple, userId, members, sharedKey, spicyActive } = useSession();
  const { items, loading, error, reload } = useGameSessions();
  const { cards, decks } = useDecks();
  const [starting, setStarting] = useState<GameType | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [openDares, setOpenDares] = useState(0);

  const loadDares = useCallback(() => {
    if (sharedKey && userId) fetchDares(sharedKey, userId).then((d) => setOpenDares(d.filter((x) => isOpen(x)).length)).catch(() => undefined);
  }, [sharedKey, userId]);
  useEffect(() => {
    if (active) {
      reload();
      loadDares();
    }
  }, [active, reload, loadDares]);
  useFocusEffect(useCallback(() => { if (active) loadDares(); }, [active, loadDares]));

  const start = async (game: GameType) => {
    if (!couple || !userId || !sharedKey || starting) return;
    if (SPICY_GAMES.includes(game) && !spicyActive) return;
    setStarting(game);
    setStartError(null);
    try {
      const dice = game === 'dice' ? diceDefs(cards, new Map(decks.map((d) => [d.id, d.name]))).filter((d) => d.id.startsWith('s:')).slice(0, 3) : undefined;
      const id = await startGame({ game, coupleId: couple.id, me: userId, members, key: sharedKey, heat: 1, dice });
      haptic.success();
      router.push(`/games/${id}` as never);
    } catch (e) {
      haptic.error();
      setStartError(errorCode(e) === 'spicy_locked' ? s.games.spicyLocked : s.states.errorBody);
    } finally {
      setStarting(null);
    }
  };

  const open = items.filter((g) => g.status === 'invited' || g.status === 'active');
  const recent = items.filter((g) => g.status === 'finished').slice(0, 5);
  const statusLabel = (st: GameStatus) => ({ invited: s.games.invited, active: s.games.playing, finished: s.games.finished, cancelled: s.games.cancelled })[st];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingTop: top + space.md, paddingBottom: bottom + space.xl }]}>
      <View style={styles.head}>
        <Txt variant="title">{s.games.title}</Txt>
        <Txt muted variant="small">{s.games.subtitle}</Txt>
      </View>

      {open.length > 0 && (
        <View style={styles.gap}>
          <Txt variant="heading">{s.games.active}</Txt>
          {open.map((g) => (
            <Pressy key={g.id} onPress={() => router.push(`/games/${g.id}` as never)}>
              <Glass style={styles.sessionRow}>
                <Txt style={styles.emojiSm}>{GAME_EMOJI[g.game_type]}</Txt>
                <View style={styles.flex}>
                  <Txt>{s.games.names[g.game_type]}</Txt>
                  <Txt variant="tiny" muted>{`${statusLabel(g.status)} · ${relativeTime(new Date(g.updated_at), s)}`}</Txt>
                </View>
                <Txt variant="small" color={colors.rose}>{s.games.resume}</Txt>
              </Glass>
            </Pressy>
          ))}
        </View>
      )}

      <Txt variant="heading">{s.games.start}</Txt>
      {startError ? <Txt color={colors.danger} variant="small">{startError}</Txt> : null}
      <View style={styles.grid}>
        {GAME_ORDER.map((g, i) => {
          const spicy = SPICY_GAMES.includes(g);
          if (spicy && !spicyActive) return null;
          return (
            <Animated.View key={g} entering={FadeInDown.delay(i * 40).springify()} style={styles.cell}>
              <Pressy onPress={() => start(g)} disabled={!!starting} accessibilityLabel={s.games.names[g]}>
                <View style={styles.card}>
                  <LinearGradient colors={spicy ? gradients.fire : ['rgba(255,138,101,0.18)', 'rgba(255,77,109,0.06)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                  <Txt style={styles.emoji}>{GAME_EMOJI[g]}</Txt>
                  <Txt variant="heading" numberOfLines={2}>{s.games.names[g]}</Txt>
                  <Txt variant="tiny" muted numberOfLines={3}>{s.games.descs[g]}</Txt>
                  {spicy ? <Txt variant="tiny" color={colors.text}>🔥 {s.games.spicyOnly}</Txt> : null}
                  {starting === g ? <Txt variant="tiny" color={colors.rose}>{s.games.starting}</Txt> : null}
                </View>
              </Pressy>
            </Animated.View>
          );
        })}
      </View>
      {!spicyActive && <Txt variant="tiny" muted center>🔒 {s.games.spicyLocked}</Txt>}

      <View style={styles.row}>
        <Pressy style={styles.flex} onPress={() => router.push('/games/dares' as never)}>
          <Glass style={styles.link}>
            <Ionicons name="flame-outline" size={22} color={colors.coral} />
            <Txt variant="heading">{s.games.dares.title}</Txt>
            <Txt variant="tiny" muted>{fmt(s.games.dares.openCount, { n: openDares })}</Txt>
          </Glass>
        </Pressy>
        <Pressy style={styles.flex} onPress={() => router.push('/decks' as never)}>
          <Glass style={styles.link}>
            <Ionicons name="albums-outline" size={22} color={colors.rose} />
            <Txt variant="heading">{s.games.decks.entry}</Txt>
            <Txt variant="tiny" muted>{s.games.decks.entryBody}</Txt>
          </Glass>
        </Pressy>
      </View>

      <View style={styles.gap}>
        <Txt variant="heading">{s.games.recent}</Txt>
        {loading ? (
          <><Skeleton height={56} /><Skeleton height={56} /></>
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : recent.length === 0 && open.length === 0 ? (
          <Txt muted center>{s.games.noGames}</Txt>
        ) : (
          recent.map((g) => (
            <Pressy key={g.id} onPress={() => router.push(`/games/${g.id}` as never)}>
              <View style={styles.recentRow}>
                <Txt>{GAME_EMOJI[g.game_type]}</Txt>
                <Txt style={styles.flex}>{s.games.names[g.game_type]}</Txt>
                <Txt variant="tiny" muted>{relativeTime(new Date(g.updated_at), s)}</Txt>
              </View>
            </Pressy>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: space.lg, gap: space.lg },
  head: { gap: 2 },
  gap: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
  cell: { width: '48.5%' },
  card: { borderRadius: radius.xl, overflow: 'hidden', padding: space.lg, minHeight: 168, gap: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  emoji: { fontSize: 34, lineHeight: 44 },
  emojiSm: { fontSize: 26, lineHeight: 34 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  link: { gap: 4, minHeight: 110 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
