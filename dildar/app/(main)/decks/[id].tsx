/**
 * Deck editor: add/edit/delete cards, bulk import, secret ↔ shared toggle.
 * Card text is encrypted on this phone before upload.
 */
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Glass } from '@/components/Glass';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { HeatBadge } from '@/components/HeatBadge';
import { IconButton } from '@/components/IconButton';
import { ListRow } from '@/components/ListRow';
import { EmptyState, ErrorState, SkeletonList } from '@/components/States';
import { colors, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useSettings } from '@/lib/settings';
import { haptic } from '@/lib/haptics';
import type { Heat } from '@/lib/database.types';
import { Chip } from '@/features/profile/ProfileForm';
import { HeatPicker } from '@/features/games/ui/HeatPicker';
import { Segmented } from '@/features/games/ui/Segmented';
import { addCards, deleteCard, deleteDeck, setDeckShared, updateCard, type CardView } from '@/features/decks/api';
import { useDecks } from '@/features/decks/useDecks';
import { parseBulk } from '@/features/decks/bulkImport';
import { HEATED, KIND_EMOJI, PAIRED } from '@/features/decks/kinds';
import { KNOW_ME_TEMPLATES } from '@/features/decks/starter';
import { splitPair, textOf } from '@/features/decks/text';

export default function DeckEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useStrings();
  const { locale } = useSettings();
  const { couple, sharedKey, partner, spicyActive } = useSession();
  const { decks, cards, loaded, error, reload } = useDecks();
  const deck = decks.find((d) => d.id === id);
  const deckCards = useMemo(() => cards.filter((c) => c.deckId === id), [cards, id]);
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [heat, setHeat] = useState<Heat>(1);
  const [bulk, setBulk] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<CardView | null>(null);

  const maxHeat: Heat = spicyActive ? 4 : 2;
  const heated = deck ? HEATED.includes(deck.kind) : false;
  const paired = deck ? PAIRED.includes(deck.kind) : false;
  const preview = useMemo(() => parseBulk(bulk, { defaultHeat: heated ? heat : 1, maxHeat: heated ? maxHeat : 4, requirePair: paired }), [bulk, heat, heated, maxHeat, paired]);

  if (!loaded) return <Screen header={<Header title={s.games.decks.title} />}><SkeletonList rows={5} /></Screen>;
  if (error) return <Screen header={<Header title={s.games.decks.title} />}><ErrorState onRetry={reload} /></Screen>;
  if (!deck || !couple || !sharedKey) return <Screen header={<Header title={s.games.decks.title} />}><EmptyState emoji="🗂️" title={s.games.notFound} /></Screen>;

  const pairHint = deck.kind === 'know_me' ? s.games.decks.knowMeHint : s.games.decks.wyrHint;

  const saveSingle = async () => {
    const t = text.trim();
    if (!t) return;
    if (paired && !splitPair(t)) return setMsg(pairHint);
    setBusy(true);
    setMsg(null);
    try {
      const h = heated ? heat : 1;
      if (editing) await updateCard(editing.id, { text: t, heat: h, category: category || undefined }, sharedKey);
      else await addCards(deck.id, couple.id, [{ text: t, heat: h, category: category || undefined }], sharedKey);
      haptic.success();
      setText('');
      setEditing(null);
      await reload();
    } catch {
      setMsg(s.states.errorBody);
    } finally {
      setBusy(false);
    }
  };

  const importBulk = async () => {
    if (!preview.cards.length) return;
    setBusy(true);
    try {
      const n = await addCards(deck.id, couple.id, preview.cards.map((c) => ({ ...c, category: category || undefined })), sharedKey);
      haptic.success();
      setBulk('');
      setMsg(fmt(s.games.decks.bulkDone, { n }));
      await reload();
    } catch {
      setMsg(s.states.errorBody);
    } finally {
      setBusy(false);
    }
  };

  const removeDeck = () =>
    Alert.alert(s.games.decks.deleteDeck, s.games.decks.deleteDeckConfirm, [
      { text: s.common.cancel, style: 'cancel' },
      { text: s.common.delete, style: 'destructive', onPress: async () => { await deleteDeck(deck.id); await reload(); router.back(); } },
    ]);

  const removeCard = (c: CardView) =>
    Alert.alert(s.games.decks.deleteCard, textOf(c.text, locale).slice(0, 80), [
      { text: s.common.cancel, style: 'cancel' },
      { text: s.common.delete, style: 'destructive', onPress: async () => { await deleteCard(c.id); haptic.warning(); reload(); } },
    ]);

  return (
    <Screen header={<Header title={`${KIND_EMOJI[deck.kind]} ${deck.name}`} />}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        <Txt variant="small" muted>{`${s.games.decks.kinds[deck.kind]} · ${fmt(s.games.decks.cards, { n: deckCards.length })}`}</Txt>

        {deck.mine && (
          <Glass padded={false} style={styles.pad}>
            <ListRow
              icon={deck.isShared ? 'people-outline' : 'lock-closed-outline'}
              title={fmt(s.games.decks.shareToggle, { name: partner?.display_name ?? s.common.partner })}
              subtitle={deck.isShared ? s.games.decks.shared : s.games.decks.secretBody}
              toggle={{ value: deck.isShared, onChange: async (v) => { await setDeckShared(deck.id, v); reload(); } }}
            />
          </Glass>
        )}

        {deck.mine && (
          <Glass style={styles.gap}>
            <Segmented value={mode} onChange={setMode} options={[{ value: 'single', label: editing ? s.common.edit : s.games.decks.addCard }, { value: 'bulk', label: s.games.decks.bulk }]} />
            {heated && <HeatPicker value={heat} onChange={setHeat} maxHeat={maxHeat} />}
            {heated && !spicyActive && <Txt variant="tiny" muted>🔒 {s.games.decks.spicyHeat}</Txt>}
            {mode === 'single' ? (
              <>
                <Input value={text} onChangeText={setText} placeholder={paired ? pairHint : s.games.decks.cardText} multiline maxLength={500} />
                {deck.kind === 'know_me' && (
                  <>
                    <Txt variant="tiny" muted>{s.games.decks.templates}</Txt>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                      {KNOW_ME_TEMPLATES.map((t, i) => <Chip key={i} label={textOf(t, locale)} active={false} onPress={() => setText(`${textOf(t, locale)} || `)} />)}
                    </ScrollView>
                  </>
                )}
                {deck.kind !== 'dice' && <Input value={category} onChangeText={setCategory} placeholder={s.games.decks.category} maxLength={40} />}
                <Button title={editing ? s.common.save : s.common.add} onPress={saveSingle} loading={busy} disabled={!text.trim()} />
                {editing && <Button title={s.common.cancel} variant="ghost" small onPress={() => { setEditing(null); setText(''); }} />}
              </>
            ) : (
              <>
                <Txt variant="tiny" muted>{paired ? s.games.decks.bulkSplitHint : s.games.decks.bulkHint}</Txt>
                <Input value={bulk} onChangeText={setBulk} multiline placeholder={heated ? '3| …\n1| …' : '…'} style={styles.bulk} />
                <Txt variant="small">{fmt(s.games.decks.bulkPreview, { n: preview.cards.length })}{preview.skipped.length ? ` · ${fmt(s.games.decks.bulkSkipped, { n: preview.skipped.length })}` : ''}</Txt>
                <Button title={s.games.decks.bulkImport} onPress={importBulk} loading={busy} disabled={!preview.cards.length} />
              </>
            )}
            {msg ? <Txt variant="small" color={colors.rose}>{msg}</Txt> : null}
          </Glass>
        )}

        {deckCards.length === 0 ? (
          <EmptyState emoji="🃏" title={s.games.decks.emptyCards} />
        ) : (
          deckCards.map((c) => (
            <Glass key={c.id} style={styles.card}>
              <View style={styles.flex}>
                {heated ? <HeatBadge heat={c.heat} /> : null}
                <Txt>{c.text}</Txt>
                {c.category && c.category !== 'general' ? <Txt variant="tiny" muted>{c.category}</Txt> : null}
              </View>
              {c.mine && (
                <View style={styles.actions}>
                  <IconButton name="create-outline" label={s.common.edit} glass={false} size={18} onPress={() => { setEditing(c); setMode('single'); setText(c.text); setHeat(c.heat); setCategory(c.category === 'general' ? '' : c.category); }} />
                  <IconButton name="trash-outline" label={s.common.delete} glass={false} size={18} color={colors.danger} onPress={() => removeCard(c)} />
                </View>
              )}
            </Glass>
          ))
        )}

        {deck.mine && <Button title={s.games.decks.deleteDeck} variant="danger" small onPress={removeDeck} icon={<Ionicons name="trash-outline" size={16} color={colors.danger} />} />}
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl * 2 },
  gap: { gap: space.md },
  pad: { paddingHorizontal: space.lg },
  chips: { gap: space.sm },
  flex: { flex: 1, gap: 4 },
  card: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  actions: { flexDirection: 'row' },
  bulk: { minHeight: 160, textAlignVertical: 'top' },
});
