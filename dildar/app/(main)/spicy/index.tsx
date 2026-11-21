/** Spicy Hub (دۆخی گەرم): adults-only, both must opt in, Face ID on entry. */
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Txt } from '@/components/Txt';
import { Pressy } from '@/components/Pressy';
import { colors, gradients, radius, space } from '@/lib/theme';
import { fmt, num, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { SpicyScreen } from '@/features/spicy/SpicyScreen';
import { ToolCard } from '@/features/spicy/ToolCard';
import { CheckinBanner } from '@/features/spicy/CheckinBanner';
import { useSpicyUnlocked } from '@/features/spicy/gate';
import { lastCheckin, loadFantasies, loadMatches, loadMyAnswers } from '@/features/spicy/api';
import { shouldShowCheckinBanner } from '@/features/spicy/checkin';

type Stats = { matches: number; lockedForMe: number; answers: number; lastCheckin: string | null };

export default function SpicyHub() {
  const s = useStrings();
  const { spicyActive, userId, sharedKey } = useSession();
  const unlocked = useSpicyUnlocked();
  const [stats, setStats] = useState<Stats | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!spicyActive || !unlocked || !userId) return;
      let alive = true;
      Promise.all([loadMatches(), loadFantasies(sharedKey), loadMyAnswers(userId), lastCheckin(userId)])
        .then(([m, f, a, c]) => {
          if (!alive) return;
          setStats({ matches: m.length, lockedForMe: f.filter((x) => !x.is_mine && !x.revealed).length, answers: Object.keys(a).length, lastCheckin: c });
        })
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, [spicyActive, unlocked, userId, sharedKey]),
  );

  return (
    <SpicyScreen title={s.spicy.title} freshAuth>
      <Animated.View entering={FadeIn} style={styles.hero}>
        <Txt style={styles.flame}>❤️‍🔥</Txt>
        <Txt muted center>{s.spicy.subtitle}</Txt>
      </Animated.View>

      {stats && shouldShowCheckinBanner(stats.answers, stats.lastCheckin) ? <CheckinBanner /> : null}

      <Pressy onPress={() => router.push('/spicy/tonight')} scaleTo={0.97} accessibilityLabel={s.spicy.tonight}>
        <LinearGradient colors={gradients.fire} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tonight}>
          <Txt variant="title">{`🔥 ${s.spicy.tonight}`}</Txt>
          <Txt variant="small" color={colors.text}>{s.spicy.tools.tonightBody}</Txt>
        </LinearGradient>
      </Pressy>

      <View style={styles.list}>
        <ToolCard index={0} icon="checkmark-done-outline" title={s.spicy.tools.ynm} body={s.spicy.tools.ynmBody} onPress={() => router.push('/spicy/ynm')} />
        <ToolCard
          index={1}
          icon="sparkles-outline"
          title={s.spicy.tools.matches}
          body={stats ? fmt(s.spicy.tools.matchesBody, { n: stats.matches }) : s.common.loading}
          badge={stats?.matches ? num(stats.matches) : null}
          onPress={() => router.push('/spicy/matches')}
        />
        <ToolCard index={2} icon="body-outline" title={s.spicy.tools.body} body={s.spicy.tools.bodyBody} onPress={() => router.push('/spicy/body')} />
        <ToolCard
          index={3}
          icon="cube-outline"
          title={s.spicy.tools.fantasies}
          body={fmt(s.spicy.tools.fantasiesBody, { n: stats?.lockedForMe ?? 0 })}
          badge={stats?.lockedForMe ? num(stats.lockedForMe) : null}
          onPress={() => router.push('/spicy/fantasies')}
        />
        <ToolCard index={4} icon="leaf-outline" title={s.spicy.tools.checkin} body={s.spicy.tools.checkinBody} onPress={() => router.push('/spicy/checkin')} />
      </View>
      <Txt variant="small" muted center>{s.spicy.privateNote}</Txt>
    </SpicyScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm },
  flame: { fontSize: 52, lineHeight: 68 },
  tonight: { borderRadius: radius.xl, padding: space.xl, alignItems: 'center', gap: space.xs },
  list: { gap: space.md },
});
