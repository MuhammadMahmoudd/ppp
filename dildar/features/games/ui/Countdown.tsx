import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Txt } from '@/components/Txt';
import { num } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';
import { colors } from '@/lib/theme';

/** Synced countdown: both phones count to the same absolute end time. */
export function Countdown({ endsAt, onEnd, big }: { endsAt: string | null; onEnd?: () => void; big?: boolean }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef<string | null>(null);
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  const left = endsAt ? Math.max(0, new Date(endsAt).getTime() - now) : 0;
  useEffect(() => {
    if (endsAt && left === 0 && fired.current !== endsAt) {
      fired.current = endsAt;
      haptic.success();
      onEnd?.();
    }
  }, [left, endsAt, onEnd]);
  const sec = Math.ceil(left / 1000);
  const label = `${num(Math.floor(sec / 60))}:${num(String(sec % 60).padStart(2, '0'))}`;
  return <Txt style={[big ? styles.big : styles.small, sec <= 5 && endsAt ? styles.hot : null]} center>{label}</Txt>;
}

const styles = StyleSheet.create({
  big: { fontSize: 64, lineHeight: 80, fontFamily: 'Vazirmatn_800ExtraBold', direction: 'ltr' },
  small: { fontSize: 20, lineHeight: 28, fontFamily: 'Vazirmatn_600SemiBold', direction: 'ltr' },
  hot: { color: colors.accent },
});
