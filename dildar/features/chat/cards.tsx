/** Rich cards for special message types (games, dares, Tonight?, buzzes…). */
import React, { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from '@/components/Txt';
import { Button } from '@/components/Button';
import { Pressy } from '@/components/Pressy';
import { HeatBadge } from '@/components/HeatBadge';
import { colors, gradients, radius, space } from '@/lib/theme';
import { fmt, num, useStrings } from '@/lib/i18n';
import { splitDuration } from '@/lib/time';
import { playPattern } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import type { MessageBody } from '@/lib/messages';
import { answerTonight, completeDare } from './actions';
import type { MsgItem } from './model';

type CardProps = { item: MsgItem; body: MessageBody; onProofVoice: (messageId: string) => void };

const GAME_EMOJI: Record<string, string> = { truth_dare: '🎭', dice: '🎲', would_you_rather: '🤔', strip: '🃏', roleplay: '🎬', tease_timer: '⏱️', know_me: '💭' };

function Shell({ children, gradient, center }: { children: React.ReactNode; gradient?: readonly [string, string, ...string[]]; center?: boolean }) {
  return (
    <View style={styles.card}>
      {gradient ? <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} /> : null}
      <View style={[styles.inner, center && styles.center]}>{children}</View>
    </View>
  );
}

function useNow(ms: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function DareCard({ item, body, onProofVoice }: CardProps & { body: Extract<MessageBody, { t: 'dare' }> }) {
  const s = useStrings();
  const now = useNow(1000);
  const meta = item.row.meta as { deadline?: string; done_at?: string };
  const deadline = new Date(meta.deadline ?? body.deadline).getTime();
  const left = deadline - now;
  const done = !!meta.done_at;
  const { d, h, m, s: sec } = splitDuration(left);
  const time = d > 0 ? `${num(d)}d ${num(h)}:${num(String(m).padStart(2, '0'))}` : `${num(h)}:${num(String(m).padStart(2, '0'))}:${num(String(sec).padStart(2, '0'))}`;
  return (
    <Shell gradient={gradients.heat[body.heat]}>
      <View style={styles.rowBetween}>
        <Txt variant="tiny">{item.mine ? s.chat.cards.dareSent : s.chat.cards.dareFor}</Txt>
        <HeatBadge heat={body.heat} compact />
      </View>
      <Txt variant="heading">{body.text}</Txt>
      {body.proof ? <Txt variant="tiny" muted>{body.proof === 'snap' ? s.chat.cards.dareProofSnap : s.chat.cards.dareProofVoice}</Txt> : null}
      <View style={styles.pill}>
        <Ionicons name={done ? 'checkmark-circle' : 'hourglass-outline'} size={14} color={colors.text} />
        <Txt variant="tiny">{done ? s.chat.cards.dareDone : left > 0 ? fmt(s.chat.cards.dareLeft, { time }) : s.chat.cards.dareExpired}</Txt>
      </View>
      {!item.mine && !done && left > 0 ? (
        body.proof === 'snap' ? (
          <Button small variant="glass" title={s.chat.cards.proofSnapButton} onPress={() => router.push({ pathname: '/snap/compose', params: { proofFor: item.id } } as never)} />
        ) : body.proof === 'voice' ? (
          <Button small variant="glass" title={s.chat.cards.proofVoiceButton} onPress={() => onProofVoice(item.id)} />
        ) : (
          <Button small variant="glass" title={s.chat.cards.doneButton} onPress={() => completeDare(item.id)} />
        )
      ) : null}
      <Button small variant="ghost" title={s.chat.cards.allDares} onPress={() => router.push('/games/dares' as never)} />
    </Shell>
  );
}

function TonightCard({ item, body }: { item: MsgItem; body: Extract<MessageBody, { t: 'tonight' }> }) {
  const s = useStrings();
  const answer = (item.row.meta as { answer?: 'yes' | 'no' }).answer;
  return (
    <Shell gradient={['#2B0A1A', '#590D22']} center>
      <Txt style={styles.bigEmoji}>🌙</Txt>
      <Txt variant="heading" center>{s.chat.cards.tonightAsk}</Txt>
      <HeatBadge heat={body.heat} />
      {body.note ? <Txt muted center>{body.note}</Txt> : null}
      {answer ? (
        <Txt variant="small">{answer === 'yes' ? s.chat.cards.tonightAnsweredYes : s.chat.cards.tonightAnsweredNo}</Txt>
      ) : item.mine ? (
        <Txt variant="small" muted>{s.chat.cards.tonightWaiting}</Txt>
      ) : (
        <View style={styles.row}>
          <Button small title={s.chat.cards.tonightYes} onPress={() => answerTonight(item.id, 'yes')} />
          <Button small variant="glass" title={s.chat.cards.tonightNo} onPress={() => answerTonight(item.id, 'no')} />
        </View>
      )}
    </Shell>
  );
}

const snapOpenedCache = new Map<string, boolean>();
function SnapCard({ item, body }: { item: MsgItem; body: Extract<MessageBody, { t: 'snap' }> }) {
  const s = useStrings();
  const [opened, setOpened] = useState<boolean | null>(snapOpenedCache.get(body.snapId) ?? null);
  useEffect(() => {
    if (opened) return;
    let alive = true;
    supabase.from('snaps').select('opened_at').eq('id', body.snapId).maybeSingle().then(({ data }) => {
      const o = !!data?.opened_at || !data;
      snapOpenedCache.set(body.snapId, o);
      if (alive) setOpened(o);
    });
    return () => {
      alive = false;
    };
  }, [body.snapId, opened, item.row.seen_at]);
  const canOpen = !item.mine && opened === false;
  return (
    <Pressy disabled={!canOpen} onPress={() => router.push(`/snap/${body.snapId}` as never)} scaleTo={0.97}>
      <View style={[styles.snap, canOpen && styles.snapNew]}>
        <View style={[styles.snapIcon, { backgroundColor: canOpen ? colors.accent : 'transparent', borderColor: colors.accent }]}>
          <Ionicons name={body.kind === 'video' ? 'videocam' : 'camera'} size={16} color={canOpen ? colors.text : colors.accent} />
        </View>
        <Txt variant="small">{item.mine ? s.chat.cards.snapSent : canOpen ? s.chat.cards.snapNew : s.chat.cards.snap}</Txt>
        {opened ? <Txt variant="tiny" muted>· {s.chat.cards.snapOpened}</Txt> : null}
      </View>
    </Pressy>
  );
}

/** Returns a card element, or null if this type renders as a normal bubble. */
export const SpecialCard = memo(function SpecialCard(p: CardProps) {
  const s = useStrings();
  const { body, item } = p;
  switch (body.t) {
    case 'game_result':
      return (
        <Pressy disabled={!body.sessionId} onPress={() => body.sessionId && router.push(`/games/${body.sessionId}` as never)} scaleTo={0.97}>
          <Shell gradient={['#2A1430', '#14090F']}>
            <View style={styles.row}>
              <Txt style={styles.emoji}>{GAME_EMOJI[body.game] ?? '🎮'}</Txt>
              <View style={styles.flex}>
                <Txt variant="tiny" muted>{s.chat.cards.gameResult} · {s.chat.cards.gameNames[body.game]}</Txt>
                <Txt>{body.summary}</Txt>
              </View>
            </View>
          </Shell>
        </Pressy>
      );
    case 'dare':
      return <DareCard {...p} body={body} />;
    case 'tonight':
      return <TonightCard item={item} body={body} />;
    case 'miss_you':
      return (
        <Shell gradient={gradients.heat[2]} center>
          <Txt style={styles.bigEmoji}>💗</Txt>
          <Txt variant="heading" center>{item.mine ? s.chat.cards.missYou : s.chat.cards.missYouFrom}</Txt>
          {body.count ? <Txt variant="tiny">×{num(body.count)}</Txt> : null}
        </Shell>
      );
    case 'touch':
      return (
        <Pressy onPress={() => playPattern(body.pattern)} scaleTo={0.97}>
          <Shell gradient={['#3A1022', '#1A0A12']}>
            <View style={styles.row}>
              <Txt style={styles.emoji}>🫶</Txt>
              <View>
                <Txt variant="tiny" muted>{s.chat.cards.touch}</Txt>
                <Txt>{s.chat.cards.touchPatterns[body.pattern]}</Txt>
              </View>
            </View>
          </Shell>
        </Pressy>
      );
    case 'screenshot': {
      const ctx = (item.row.meta as { context?: string }).context ?? body.context;
      const label = (s.chat.cards.screenshotContext as Record<string, string>)[ctx] ?? '';
      return (
        <View style={styles.system}>
          <Txt variant="small" color={colors.warning}>{`${s.chat.cards.screenshot} ${label}`}</Txt>
        </View>
      );
    }
    case 'snap':
      return <SnapCard item={item} body={body} />;
    case 'envelope':
      return (
        <Pressy onPress={() => router.push(`/closeness/envelopes/${body.envelopeId}` as never)} scaleTo={0.97}>
          <Shell gradient={['#4A1B2A', '#24101A']}>
            <View style={styles.row}>
              <Txt style={styles.emoji}>💌</Txt>
              <View style={styles.flex}>
                <Txt variant="tiny" muted>{s.chat.cards.envelope}</Txt>
                <Txt>{body.title}</Txt>
                <Txt variant="tiny" muted>{s.chat.cards.envelopeOpen}</Txt>
              </View>
            </View>
          </Shell>
        </Pressy>
      );
    case 'streak':
      return (
        <View style={styles.system}>
          <Txt variant="small" color={colors.coral}>{fmt(s.chat.cards.streak, { n: body.days })}</Txt>
        </View>
      );
    case 'system':
      return (
        <View style={styles.system}>
          <Txt variant="small" muted>{body.text}</Txt>
        </View>
      );
    default:
      return null;
  }
});

/** Types that render centered rather than as a side bubble. */
export function isCentered(t: MessageBody['t']): boolean {
  return t === 'screenshot' || t === 'streak' || t === 'system';
}

export function isCard(t: MessageBody['t']): boolean {
  return !['text', 'image', 'video', 'voice'].includes(t);
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', minWidth: 220, maxWidth: 290, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  inner: { padding: space.md, gap: space.sm },
  center: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flex: { flex: 1 },
  emoji: { fontSize: 28, lineHeight: 36 },
  bigEmoji: { fontSize: 36, lineHeight: 46 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
  system: { alignSelf: 'center', paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surface },
  snap: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  snapNew: { borderColor: colors.accent },
  snapIcon: { width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
