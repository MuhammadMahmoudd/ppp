import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Glass } from '@/components/Glass';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Txt } from '@/components/Txt';
import { Pressy } from '@/components/Pressy';
import { EmptyState, ErrorState, SkeletonList } from '@/components/States';
import { colors, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { haptic } from '@/lib/haptics';
import type { DeckKind } from '@/lib/database.types';
import { Chip } from '@/features/profile/ProfileForm';
import { createDeck } from '@/features/decks/api';
import { useDecks } from '@/features/decks/useDecks';
import { DECK_KINDS, KIND_EMOJI, SPICY_KINDS } from '@/features/decks/kinds';
import { STARTER_CARDS, STARTER_WYR } from '@/features/decks/starter';

export default function Decks() {
  const s = useStrings();
  const { couple, sharedKey, partner, spicyActive } = useSession();
  const { decks, cards, loaded, error, reload } = useDecks({ refreshOnFocus: true });
  const [name, setName] = useState('');
  const [kind, setKind] = useState<DeckKind>('truth');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const kinds = DECK_KINDS.filter((k) => spicyActive || !SPICY_KINDS.includes(k));

  const create = async () => {
    if (!couple || !sharedKey || !name.trim()) return;
    setBusy(true);
    try {
      const id = await createDeck(couple.id, kind, name, sharedKey);
      haptic.success();
      setName('');
      setCreating(false);
      await reload();
      router.push(`/decks/${id}` as never);
    } finally {
      setBusy(false);
    }
  };

  const count = (id: string) => cards.filter((c) => c.deckId === id).length;
  const mine = decks.filter((d) => d.mine);
  const theirs = decks.filter((d) => !d.mine);

  const DeckRow = ({ id, title, kindOf, sub }: { id: string; title: string; kindOf: DeckKind; sub: string }) => (
    <Pressy onPress={() => router.push(`/decks/${id}` as never)}>
      <Glass style={styles.deck}>
        <Txt style={styles.emoji}>{KIND_EMOJI[kindOf]}</Txt>
        <View style={styles.flex}>
          <Txt variant="heading" numberOfLines={1}>{title}</Txt>
          <Txt variant="tiny" muted>{`${s.games.decks.kinds[kindOf]} · ${sub}`}</Txt>
        </View>
      </Glass>
    </Pressy>
  );

  return (
    <Screen header={<Header title={s.games.decks.title} right={<Button title="+" small variant="glass" onPress={() => setCreating((c) => !c)} />} />}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        {creating && (
          <Glass style={styles.gap}>
            <Txt variant="heading">{s.games.decks.newDeck}</Txt>
            <Input label={s.games.decks.name} value={name} onChangeText={setName} maxLength={60} autoFocus />
            <Txt variant="small" muted>{s.games.decks.kind}</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {kinds.map((k) => <Chip key={k} label={`${KIND_EMOJI[k]} ${s.games.decks.kinds[k]}`} active={k === kind} onPress={() => setKind(k)} />)}
            </ScrollView>
            <Txt variant="tiny" muted>{s.games.decks.secretBody}</Txt>
            <Button title={s.common.add} onPress={create} loading={busy} disabled={!name.trim()} />
          </Glass>
        )}

        <Glass style={styles.gap}>
          <Txt variant="heading">✨ {s.games.decks.builtIn}</Txt>
          <Txt variant="small" muted>{s.games.decks.builtInBody}</Txt>
          <Txt variant="tiny" muted>{fmt(s.games.decks.cards, { n: STARTER_CARDS.length + STARTER_WYR.length })}</Txt>
        </Glass>

        {!loaded ? (
          <SkeletonList rows={4} />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : decks.length === 0 ? (
          <EmptyState emoji="🗂️" title={s.games.decks.empty} action={{ label: s.games.decks.newDeck, onPress: () => setCreating(true) }} />
        ) : (
          <>
            {mine.length > 0 && <Txt variant="heading">{s.games.decks.mine}</Txt>}
            {mine.map((d) => (
              <DeckRow key={d.id} id={d.id} title={d.name} kindOf={d.kind} sub={`${fmt(s.games.decks.cards, { n: count(d.id) })} · ${d.isShared ? s.games.decks.shared : s.games.decks.secret}`} />
            ))}
            {theirs.length > 0 && <Txt variant="heading">{fmt(s.games.decks.theirs, { name: partner?.display_name ?? s.common.partner })}</Txt>}
            {theirs.map((d) => (
              <DeckRow key={d.id} id={d.id} title={d.name} kindOf={d.kind} sub={fmt(s.games.decks.cards, { n: count(d.id) })} />
            ))}
          </>
        )}
        <Txt variant="tiny" color={colors.textFaint} center>{s.games.decks.secretBody}</Txt>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl * 2 },
  gap: { gap: space.md },
  chips: { gap: space.sm },
  flex: { flex: 1 },
  deck: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  emoji: { fontSize: 28, lineHeight: 36 },
});
