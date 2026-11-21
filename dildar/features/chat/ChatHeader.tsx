import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/Avatar';
import { Txt } from '@/components/Txt';
import { Pressy } from '@/components/Pressy';
import { colors, radius, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { formatClock } from '@/lib/time';
import { usePresence } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import type { DisappearMode, ProfileRow } from '@/lib/database.types';

const NEXT: Record<DisappearMode, DisappearMode> = { off: 'view', view: '24h', '24h': 'off' };

function Dot({ i }: { i: number }) {
  const o = useSharedValue(0.3);
  useEffect(() => {
    o.value = withDelay(i * 150, withRepeat(withSequence(withTiming(1, { duration: 300 }), withTiming(0.3, { duration: 300 })), -1));
  }, [i, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, a]} />;
}

export function ChatHeader({ partner, typing, mode }: { partner: ProfileRow | null; typing: boolean; mode: DisappearMode }) {
  const s = useStrings();
  const { partnerOnline } = usePresence();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const clock = partner ? fmt(s.chat.theirTime, { time: formatClock(now, partner.timezone) }) : '';
  return (
    <View style={styles.wrap}>
      <Avatar profile={partner} size={36} ring={partnerOnline} />
      <View style={styles.flex}>
        <Txt variant="heading" numberOfLines={1}>{partner?.display_name ?? ''}</Txt>
        {typing ? (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.typing}>
            <Txt variant="tiny" color={colors.rose}>{s.chat.typing}</Txt>
            <Dot i={0} /><Dot i={1} /><Dot i={2} />
          </Animated.View>
        ) : (
          <Txt variant="tiny" muted numberOfLines={1}>{partnerOnline ? `${s.chat.online} · ${clock}` : clock}</Txt>
        )}
      </View>
      <Pressy
        hapticStyle="select"
        accessibilityLabel={s.chat.disappear[mode]}
        onPress={() => supabase.rpc('update_couple_settings', { p_chat_disappear_mode: NEXT[mode] })}
        style={[styles.mode, mode !== 'off' && styles.modeOn]}
      >
        <Ionicons name={mode === 'off' ? 'infinite' : 'timer'} size={14} color={colors.text} />
        <Txt variant="tiny">{s.chat.disappearShort[mode]}</Txt>
      </Pressy>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  flex: { flex: 1 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.rose },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 30, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  modeOn: { backgroundColor: 'rgba(255,77,109,0.3)', borderColor: colors.accent },
});
