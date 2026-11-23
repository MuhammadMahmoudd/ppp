/**
 * One letter. Author: always readable. Partner: 'date' letters stay sealed
 * (server-enforced) until unlock_at; 'when' letters open on demand. Opening
 * marks opened_at and plays a little reveal.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { colors, gradients, radius, space, springs } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { api } from '@/lib/api';
import { tryOpenString } from '@/lib/crypto';
import { haptic } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/settings';
import type { EnvelopeRow } from '@/lib/database.types';
import { useNow } from '@/features/closeness/hooks';
import { countdownParts } from '@/features/closeness/logic';
import { CountdownDigits } from '@/features/closeness/ui';

type Loaded = { env: EnvelopeRow; title: string | null; letter: string | null };

export default function EnvelopeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useStrings();
  const e = s.closeness.envelopes;
  const { userId, sharedKey, partner } = useSession();
  const reduce = useReducedMotion();
  const now = useNow(1000);
  const [state, setState] = useState<Loaded | null | 'missing'>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const flap = useSharedValue(0);
  const paper = useSharedValue(0);

  const load = useCallback(async () => {
    setError(false);
    const { data, error: err } = await api.from('envelopes').select('*').eq('id', id).maybeSingle();
    if (err) return setError(true);
    if (!data) return setState('missing');
    const c = await api.from('envelope_contents').select('*').eq('envelope_id', id).maybeSingle();
    setState({
      env: data,
      title: tryOpenString(data.title_ciphertext, data.title_nonce, sharedKey),
      letter: c.data ? tryOpenString(c.data.ciphertext, c.data.nonce, sharedKey) : null,
    });
  }, [id, sharedKey]);

  useEffect(() => {
    load();
  }, [load]);

  const loaded = state && state !== 'missing' ? state : null;
  const mine = loaded?.env.author_id === userId;
  const lockedUntil = loaded && !mine && loaded.env.kind === 'date' && loaded.env.unlock_at ? loaded.env.unlock_at : null;
  const isLocked = !!lockedUntil && !countdownParts(lockedUntil, now).arrived;
  const isOpen = !!loaded && (mine || !!loaded.env.opened_at);

  useEffect(() => {
    if (isOpen && loaded?.letter) {
      flap.value = reduce ? 1 : withTiming(1, { duration: 600 });
      paper.value = reduce ? 1 : withDelay(350, withSpring(1, springs.soft));
    }
  }, [isOpen, loaded?.letter, reduce, flap, paper]);

  // When the timer runs out while watching, refetch: RLS now releases the content.
  const refetchedAtUnlock = useRef(false);
  useEffect(() => {
    if (lockedUntil && !isLocked && loaded && !loaded.letter && !refetchedAtUnlock.current) {
      refetchedAtUnlock.current = true;
      // small delay absorbs clock skew between phone and server
      setTimeout(load, 1500);
    }
  }, [lockedUntil, isLocked, loaded, load]);

  const open = async () => {
    setBusy(true);
    const { error: err } = await api.rpc('open_envelope', { p_id: id });
    setBusy(false);
    if (err) {
      haptic.error();
      return;
    }
    haptic.success();
    await load();
  };

  const flapStyle = useAnimatedStyle(() => ({ transform: [{ perspective: 600 }, { rotateX: `${flap.value * 160}deg` }], opacity: 1 - flap.value * 0.6 }));
  const paperStyle = useAnimatedStyle(() => ({ opacity: paper.value, transform: [{ translateY: (1 - paper.value) * 60 }] }));

  if (error) return <Screen header={<Header title={e.title} />}><ErrorState onRetry={load} /></Screen>;
  if (state === 'missing') return <Screen header={<Header title={e.title} />}><EmptyState emoji="💌" title={e.notFound} /></Screen>;
  if (!loaded) return <Screen header={<Header title={e.title} />}><View style={styles.pad}><Skeleton height={240} /></View></Screen>;

  return (
    <Screen scroll header={<Header title={e.title} />}>
      <Txt variant="small" muted center>{mine ? e.fromYou : fmt(e.fromThem, { name: partner?.display_name ?? s.common.partner })}</Txt>
      <View style={styles.envelope}>
        <LinearGradient colors={gradients.heat[3]} style={styles.body} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Txt variant="title" center>{loaded.title ?? s.states.decryptFailed}</Txt>
          <Txt style={styles.seal}>{isLocked ? '🔒' : isOpen ? '💌' : '💗'}</Txt>
        </LinearGradient>
        {!isOpen && <Animated.View style={[styles.flap, flapStyle]} />}
      </View>

      {isLocked && lockedUntil && (
        <Animated.View entering={FadeIn} style={styles.gap}>
          <Txt center muted>{e.unlocksIn}</Txt>
          <CountdownDigits targetIso={lockedUntil} now={now} />
        </Animated.View>
      )}

      {!isLocked && !isOpen && (
        <Button title={loaded.env.kind === 'when' ? e.openNow : e.open} onPress={open} loading={busy} />
      )}

      {isOpen && (
        <Animated.View style={[styles.paper, paperStyle]}>
          <Txt style={styles.letter}>{loaded.letter ?? s.states.decryptFailed}</Txt>
        </Animated.View>
      )}
      {mine && <Txt variant="small" muted center>{loaded.env.opened_at ? e.opened : e.notOpened}</Txt>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.lg },
  gap: { gap: space.md },
  envelope: { borderRadius: radius.xl, overflow: 'hidden', marginTop: space.md },
  body: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  seal: { fontSize: 44, lineHeight: 56 },
  flap: { position: 'absolute', top: 0, start: 0, end: 0, height: 80, backgroundColor: 'rgba(0,0,0,0.25)', borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  paper: { backgroundColor: '#F7EEF0', borderRadius: radius.lg, padding: space.xl },
  letter: { color: colors.bg, fontSize: 17, lineHeight: 30 },
});
