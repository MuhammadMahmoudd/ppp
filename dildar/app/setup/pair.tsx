/**
 * Step 2: pairing. A creates a 6-digit code (15 min, single use); B enters
 * it. Both confirm 18+. The DB trigger guarantees no third member, ever.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Txt } from '@/components/Txt';
import { Glass } from '@/components/Glass';
import { Pressy } from '@/components/Pressy';
import { colors, radius, space } from '@/lib/theme';
import { fmt, num, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase, errorCode } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { splitDuration } from '@/lib/time';

type Mode = 'choose' | 'create' | 'join';

export default function Pair() {
  const s = useStrings();
  const { refresh, signOut } = useSession();
  const [adult, setAdult] = useState(false);
  const [mode, setMode] = useState<Mode>('choose');
  const [code, setCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [entered, setEntered] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const errText = (c: string) => (s.pairing.errors as Record<string, string>)[c] ?? s.auth.errors.generic;

  const newCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const c = await supabase.rpc('create_couple', { adult_confirmed: true });
      if (c.error) throw c.error;
      const inv = await supabase.rpc('create_invite');
      if (inv.error) throw inv.error;
      setCode(inv.data?.[0] ?? null);
      haptic.success();
      await refresh();
    } catch (e) {
      setError(errText(errorCode(e)));
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    if (!/^\d{6}$/.test(entered)) return setError(errText('invalid_code'));
    setBusy(true);
    setError(null);
    try {
      const r = await supabase.rpc('redeem_invite', { invite_code: entered, adult_confirmed: true });
      if (r.error) throw r.error;
      if (!r.data) throw new Error('invalid_code');
      haptic.success();
      await refresh();
    } catch (e) {
      haptic.error();
      setError(errText(errorCode(e)));
    } finally {
      setBusy(false);
    }
  };

  // While showing a code: tick the countdown and poll for the partner.
  useEffect(() => {
    if (mode !== 'create' || !code) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    const p = setInterval(() => refresh(), 4000);
    return () => {
      clearInterval(t);
      clearInterval(p);
    };
  }, [mode, code, refresh]);

  const left = code ? new Date(code.expires_at).getTime() - now : 0;
  const { m, s: sec } = splitDuration(left);

  return (
    <Screen scroll>
      <Animated.View entering={FadeInDown} style={styles.hero}>
        <Txt style={styles.emoji}>💞</Txt>
        <Txt variant="title" center>{s.pairing.title}</Txt>
        <Txt muted center>{s.pairing.subtitle}</Txt>
      </Animated.View>

      <Glass style={styles.gap}>
        <Txt variant="heading">{s.pairing.adultTitle}</Txt>
        <Txt muted variant="small">{s.pairing.adultBody}</Txt>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: adult }} onPress={() => { haptic.select(); setAdult(!adult); }} style={styles.check}>
          <Ionicons name={adult ? 'checkbox' : 'square-outline'} size={26} color={adult ? colors.rose : colors.textMuted} />
          <Txt style={styles.flex}>{s.pairing.adultCheck}</Txt>
        </Pressable>
      </Glass>

      {mode === 'choose' && (
        <View style={styles.gap}>
          <Pressy disabled={!adult} onPress={() => { setMode('create'); newCode(); }} style={[!adult && styles.dim]}>
            <Glass style={styles.option}>
              <Ionicons name="key-outline" size={28} color={colors.rose} />
              <View style={styles.flex}>
                <Txt variant="heading">{s.pairing.createTitle}</Txt>
                <Txt muted variant="small">{s.pairing.createBody}</Txt>
              </View>
            </Glass>
          </Pressy>
          <Pressy disabled={!adult} onPress={() => setMode('join')} style={[!adult && styles.dim]}>
            <Glass style={styles.option}>
              <Ionicons name="enter-outline" size={28} color={colors.rose} />
              <View style={styles.flex}>
                <Txt variant="heading">{s.pairing.joinTitle}</Txt>
                <Txt muted variant="small">{s.pairing.joinBody}</Txt>
              </View>
            </Glass>
          </Pressy>
        </View>
      )}

      {mode === 'create' && (
        <Glass style={[styles.gap, styles.center]}>
          <Txt muted>{s.pairing.yourCode}</Txt>
          {code ? (
            <Animated.View entering={ZoomIn.springify()}>
              <Pressy onPress={async () => { await Clipboard.setStringAsync(code.code); haptic.success(); }} style={styles.codeBox}>
                <Txt style={styles.code}>{num(code.code.replace(/(\d{3})(\d{3})/, '$1 $2'))}</Txt>
              </Pressy>
            </Animated.View>
          ) : (
            <Txt muted>{s.common.loading}</Txt>
          )}
          {code && left > 0 && <Txt muted variant="small">{fmt(s.pairing.expiresIn, { time: `${num(m)}:${num(String(sec).padStart(2, '0'))}` })}</Txt>}
          <Animated.View entering={FadeIn.delay(400)}><Txt>{s.pairing.waiting}</Txt></Animated.View>
          {(!code || left <= 0) && <Button title={s.pairing.newCode} onPress={newCode} loading={busy} variant="glass" small />}
        </Glass>
      )}

      {mode === 'join' && (
        <Glass style={styles.gap}>
          <Input
            label={s.pairing.enterCode}
            value={entered}
            onChangeText={(t) => setEntered(t.replace(/[^0-9٠-٩]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            style={styles.codeInput}
            maxLength={6}
            autoFocus
          />
          <Button title={s.pairing.join} onPress={join} loading={busy} disabled={entered.length !== 6} />
        </Glass>
      )}

      {error ? <Txt color={colors.danger} center>{error}</Txt> : null}
      {mode !== 'choose' && <Button title={s.common.back} variant="ghost" small onPress={() => { setMode('choose'); setError(null); }} />}
      <Button title={s.auth.signOut} variant="ghost" small onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, paddingTop: space.xl },
  emoji: { fontSize: 56, lineHeight: 72 },
  gap: { gap: space.md },
  center: { alignItems: 'center' },
  flex: { flex: 1 },
  check: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  dim: { opacity: 0.4 },
  codeBox: { paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceStrong },
  code: { fontSize: 44, lineHeight: 60, letterSpacing: 6, fontFamily: 'Vazirmatn_800ExtraBold', direction: 'ltr' },
  codeInput: { fontSize: 32, letterSpacing: 10, textAlign: 'center' },
});
