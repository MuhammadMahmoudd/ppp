/** "Tonight?" (ئەمشەو؟) — a discreet signal with a heat level. */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Glass } from '@/components/Glass';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { Pressy } from '@/components/Pressy';
import { HEAT_EMOJI } from '@/components/HeatBadge';
import { colors, gradients, radius, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { haptic } from '@/lib/haptics';
import type { Heat } from '@/lib/database.types';
import { SpicyScreen } from '@/features/spicy/SpicyScreen';
import { sendTonight } from '@/features/spicy/tonight';

export default function Tonight() {
  const s = useStrings();
  const { couple, userId, sharedKey } = useSession();
  const [heat, setHeat] = useState<Heat>(2);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!couple || !userId || !sharedKey) return;
    haptic.send();
    await sendTonight({ coupleId: couple.id, senderId: userId, key: sharedKey, heat, note });
    setSent(true);
    haptic.success();
    setTimeout(() => router.back(), 1400);
  };

  return (
    <SpicyScreen title={s.spicy.tonightSheet.title}>
      <Txt muted center>{s.spicy.tonightSheet.body}</Txt>
      {sent ? (
        <Animated.View entering={ZoomIn.springify()} style={styles.center}>
          <Txt style={styles.big}>{HEAT_EMOJI[heat]}</Txt>
          <Txt variant="heading" center>{s.spicy.tonightSheet.sent}</Txt>
        </Animated.View>
      ) : (
        <>
          <Glass style={styles.gap}>
            <Txt variant="heading">{s.spicy.tonightSheet.heat}</Txt>
            <View style={styles.heats}>
              {([1, 2, 3, 4] as Heat[]).map((h) => (
                <Pressy key={h} hapticStyle="select" onPress={() => setHeat(h)} style={styles.heatWrap} accessibilityLabel={s.heat[h]}>
                  <LinearGradient colors={heat === h ? gradients.heat[h] : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.05)']} style={[styles.heat, heat === h && styles.heatOn]}>
                    <Txt style={styles.emoji}>{HEAT_EMOJI[h]}</Txt>
                    <Txt variant="tiny">{s.heat[h]}</Txt>
                  </LinearGradient>
                </Pressy>
              ))}
            </View>
            <Input label={s.spicy.tonightSheet.note} value={note} onChangeText={setNote} placeholder={s.spicy.tonightSheet.notePlaceholder} maxLength={80} />
          </Glass>
          <Button title={s.spicy.tonightSheet.send} onPress={send} disabled={!sharedKey} />
        </>
      )}
    </SpicyScreen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  center: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  big: { fontSize: 80, lineHeight: 100 },
  heats: { flexDirection: 'row', gap: space.sm },
  heatWrap: { flex: 1 },
  heat: { borderRadius: radius.lg, paddingVertical: space.md, alignItems: 'center', gap: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  heatOn: { borderColor: colors.rose },
  emoji: { fontSize: 26, lineHeight: 34 },
});
