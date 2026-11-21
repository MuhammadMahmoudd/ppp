/**
 * Touch tap (دەستلێدان): tap anywhere → ripple + haptic here, and the same
 * pattern + ripple position on their phone. Live via broadcast when they're
 * in the app; otherwise as a 'touch' chat card + push (throttled).
 */
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Txt } from '@/components/Txt';
import { colors, radius, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { broadcast, usePresence } from '@/lib/realtime';
import { playPattern, type TouchPattern } from '@/lib/haptics';
import { postMessage } from '@/lib/messages';
import { Chip } from '@/features/profile/ProfileForm';
import { Ripple, type RippleSpec } from '@/features/closeness/ui';

const CHOICES: TouchPattern[] = ['heartbeat', 'slow', 'tease', 'long'];
const OFFLINE_THROTTLE_MS = 8000;

export default function TouchScreen() {
  const s = useStrings();
  const t = s.closeness.touch;
  const { couple, userId, sharedKey } = useSession();
  const { partnerOnline } = usePresence();
  const [pattern, setPattern] = useState<TouchPattern>('heartbeat');
  const [ripples, setRipples] = useState<RippleSpec[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const size = useRef({ w: 1, h: 1 });
  const lastPost = useRef(0);
  const seq = useRef(1);

  const onLayout = (e: LayoutChangeEvent) => {
    size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  };

  const onTap = (e: GestureResponderEvent) => {
    const { locationX: x, locationY: y } = e.nativeEvent;
    const id = seq.current++;
    setRipples((r) => [...r.slice(-8), { id, x, y }]);
    playPattern(pattern);
    const rx = Math.max(0, Math.min(1, x / size.current.w));
    const ry = Math.max(0, Math.min(1, y / size.current.h));
    if (partnerOnline) {
      broadcast('touch', { pattern, x: rx, y: ry });
      setNote(t.sent);
    } else if (couple && userId && sharedKey && Date.now() - lastPost.current > OFFLINE_THROTTLE_MS) {
      lastPost.current = Date.now();
      postMessage({ coupleId: couple.id, senderId: userId, key: sharedKey, type: 'touch', body: { t: 'touch', pattern } }).catch(() => undefined);
      setNote(t.sent);
    }
  };

  const removeRipple = useCallback((id: number) => setRipples((r) => r.filter((x) => x.id !== id)), []);

  return (
    <Screen header={<Header title={t.title} />} contentStyle={styles.content}>
      <Txt muted center>{t.body}</Txt>
      <View style={styles.status}>
        <View style={[styles.dot, { backgroundColor: partnerOnline ? colors.success : colors.textFaint }]} />
        <Txt variant="small" muted>{partnerOnline ? t.live : t.offline}</Txt>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsWrap}>
        {CHOICES.map((p) => <Chip key={p} label={t.patterns[p as keyof typeof t.patterns]} active={pattern === p} onPress={() => { setPattern(p); playPattern(p); }} />)}
      </ScrollView>
      <Pressable onPress={onTap} onLayout={onLayout} style={styles.canvas} accessibilityRole="button" accessibilityLabel={t.hint}>
        <LinearGradient colors={['#2A0E18', '#120A0D']} style={StyleSheet.absoluteFill} />
        <View style={styles.hint} pointerEvents="none">
          <Txt style={styles.hand}>🫶</Txt>
          <Txt muted>{t.hint}</Txt>
        </View>
        <View style={styles.ltrLayer} pointerEvents="none">
          {ripples.map((r) => <Ripple key={r.id} spec={r} onDone={removeRipple} />)}
        </View>
      </Pressable>
      <Txt variant="small" muted center style={styles.note}>{note ?? ' '}</Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipsWrap: { flexGrow: 0 },
  chips: { gap: space.sm },
  canvas: { flex: 1, borderRadius: radius.xl, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  hint: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: space.sm, opacity: 0.6 },
  hand: { fontSize: 56, lineHeight: 72 },
  note: { minHeight: 20 },
  // physical coordinates: keep absolute `left` un-mirrored in RTL
  ltrLayer: { ...StyleSheet.absoluteFillObject, direction: 'ltr' },
});
