/** Fantasy box (سندوقی خەیاڵ): teasers until the partner says "interested". */
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Glass } from '@/components/Glass';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { Pressy } from '@/components/Pressy';
import { HeatBadge, HEAT_EMOJI } from '@/components/HeatBadge';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { colors, radius, space } from '@/lib/theme';
import { relativeTime, useStrings } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/settings';
import { useSession } from '@/lib/session';
import { haptic } from '@/lib/haptics';
import type { Heat } from '@/lib/database.types';
import { SpicyScreen } from '@/features/spicy/SpicyScreen';
import { useSpicyUnlocked } from '@/features/spicy/gate';
import { useAsync } from '@/features/spicy/useAsync';
import { addFantasy, deleteFantasy, loadFantasies, setFantasyInterest, type Fantasy } from '@/features/spicy/api';

const CATEGORIES = ['mood', 'place', 'roleplay', 'outfit', 'surprise', 'other'] as const;
type Cat = (typeof CATEGORIES)[number];

export default function FantasyBox() {
  const s = useStrings();
  const reduce = useReducedMotion();
  const { couple, sharedKey, spicyActive } = useSession();
  const unlocked = useSpicyUnlocked();
  const list = useAsync(() => loadFantasies(sharedKey), [sharedKey], spicyActive && unlocked);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [cat, setCat] = useState<Cat>('mood');
  const [heat, setHeat] = useState<Heat>(2);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const catLabel = (c: string) => (s.spicy.fantasy.categories as Record<string, string>)[c] ?? c;

  const submit = async () => {
    if (!couple || !sharedKey || !text.trim()) return;
    setBusy(true);
    try {
      await addFantasy(couple.id, cat, heat, text, sharedKey);
      setText('');
      setOpen(false);
      setToast(s.spicy.fantasy.added);
      setTimeout(() => setToast(null), 2500);
      haptic.success();
      await list.reload();
    } catch {
      haptic.error();
    } finally {
      setBusy(false);
    }
  };

  const interested = async (f: Fantasy) => {
    try {
      await setFantasyInterest(f.id, true);
      haptic.success();
      await list.reload();
    } catch {
      haptic.error();
    }
  };

  const remove = (f: Fantasy) =>
    Alert.alert(s.spicy.fantasy.deleteConfirm, undefined, [
      { text: s.common.cancel, style: 'cancel' },
      { text: s.common.delete, style: 'destructive', onPress: async () => { await deleteFantasy(f.id).catch(() => undefined); list.reload(); } },
    ]);

  return (
    <SpicyScreen title={s.spicy.fantasy.title}>
      <Txt muted>{s.spicy.fantasy.intro}</Txt>

      {open ? (
        <Glass style={styles.gap}>
          <Input value={text} onChangeText={setText} placeholder={s.spicy.fantasy.placeholder} multiline maxLength={600} style={styles.multiline} autoFocus />
          <Txt variant="small" muted>{s.spicy.fantasy.category}</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {CATEGORIES.map((c) => (
              <Pressy key={c} hapticStyle="select" onPress={() => setCat(c)} style={[styles.chip, cat === c && styles.chipOn]}>
                <Txt variant="small" color={cat === c ? colors.text : colors.textMuted}>{catLabel(c)}</Txt>
              </Pressy>
            ))}
          </ScrollView>
          <Txt variant="small" muted>{s.spicy.fantasy.heat}</Txt>
          <View style={styles.chips}>
            {([1, 2, 3, 4] as Heat[]).map((h) => (
              <Pressy key={h} hapticStyle="select" onPress={() => setHeat(h)} style={[styles.chip, heat === h && styles.chipOn]}>
                <Txt variant="small">{`${HEAT_EMOJI[h]} ${s.heat[h]}`}</Txt>
              </Pressy>
            ))}
          </View>
          <Button title={s.spicy.fantasy.submit} onPress={submit} loading={busy} disabled={!text.trim() || !sharedKey} />
          <Button title={s.common.cancel} variant="ghost" small onPress={() => setOpen(false)} />
        </Glass>
      ) : (
        <Button title={s.spicy.fantasy.add} onPress={() => setOpen(true)} icon={<Ionicons name="add" size={20} color={colors.text} />} />
      )}
      {toast ? <Txt color={colors.success} center>{toast}</Txt> : null}

      {list.error ? <ErrorState onRetry={list.reload} /> : !list.data ? (
        <View style={styles.gap}>{[0, 1, 2].map((i) => <Skeleton key={i} height={90} />)}</View>
      ) : list.data.length === 0 ? (
        <EmptyState emoji="🎁" title={s.spicy.fantasy.empty} />
      ) : (
        list.data.map((f, i) => (
          <Animated.View key={f.id} entering={reduce ? undefined : FadeInDown.delay(i * 40).springify()} layout={reduce ? undefined : LinearTransition}>
            <Pressy onLongPress={f.is_mine ? () => remove(f) : undefined} hapticStyle="none" scaleTo={0.99}>
              <Glass style={[styles.gap, !f.is_mine && !f.revealed && styles.locked]}>
                <View style={styles.row}>
                  <HeatBadge heat={f.heat} />
                  <Txt variant="small" muted>{catLabel(f.category)}</Txt>
                  <View style={styles.flex} />
                  <Txt variant="tiny" muted>{`${f.is_mine ? s.spicy.fantasy.mine : s.spicy.fantasy.theirs} · ${relativeTime(new Date(f.created_at), s)}`}</Txt>
                </View>
                {f.text ? (
                  <Txt>{f.text}</Txt>
                ) : (
                  <View style={styles.teaser}>
                    <Ionicons name="lock-closed" size={18} color={colors.rose} />
                    <Txt muted>{s.spicy.fantasy.teaser}</Txt>
                  </View>
                )}
                {!f.is_mine && !f.revealed ? (
                  <Button title={s.spicy.fantasy.interested} small onPress={() => interested(f)} />
                ) : f.revealed ? (
                  <Txt variant="small" color={colors.coral}>{s.spicy.fantasy.revealedBoth}</Txt>
                ) : (
                  <Txt variant="small" muted>{s.spicy.fantasy.waiting}</Txt>
                )}
              </Glass>
            </Pressy>
          </Animated.View>
        ))
      )}
      <Txt variant="small" muted center>{s.spicy.privateNote}</Txt>
    </SpicyScreen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chip: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  locked: { borderColor: 'rgba(255,77,109,0.35)' },
  teaser: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: 'rgba(255,77,109,0.08)' },
});
