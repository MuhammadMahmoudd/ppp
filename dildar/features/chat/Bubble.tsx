/**
 * One message row. Gestures:
 *  • swipe toward the pager's dead-end side → reply (blocks the pager)
 *  • double-tap → ❤️   • long-press → reaction picker / actions
 * Mine sit on the end side (left in RTL), theirs on the start side.
 */
import React, { memo, useMemo } from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInUp, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from '@/components/Txt';
import { Pressy } from '@/components/Pressy';
import { colors, radius, space, springs } from '@/lib/theme';
import { haptic } from '@/lib/haptics';
import { num, useStrings } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/settings';
import { flush } from '@/lib/offlineQueue';
import type { MessageBody } from '@/lib/messages';
import type { ReactionRow } from '@/lib/database.types';
import { usePager } from '@/features/home/Pager';
import type { MsgItem } from './model';
import { isTombstone } from './model';
import { EncryptedImage, VideoThumb, VoiceNote } from './MediaContent';
import { SpecialCard, isCard, isCentered } from './cards';

const REPLY_DIR = I18nManager.isRTL ? -1 : 1; // swipe direction that is a dead end for the pager on the chat page
const THRESHOLD = 64;

export type BubbleProps = {
  item: MsgItem;
  body: MessageBody | null;
  keyBytes: Uint8Array | null;
  me: string;
  reply: { author: string; text: string } | null;
  onReply: (id: string) => void;
  onLongPress: (item: MsgItem) => void;
  onDoubleTap: (item: MsgItem) => void;
  onProofVoice: (id: string) => void;
};

function time(iso: string) {
  const d = new Date(iso);
  return num(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
}

function Reactions({ list, mine }: { list: ReactionRow[]; mine: boolean }) {
  if (!list.length) return null;
  return (
    <View style={[styles.reactions, mine ? styles.reactMine : styles.reactTheirs]}>
      {list.map((r) => <Txt key={r.user_id} style={styles.reactEmoji}>{r.emoji}</Txt>)}
    </View>
  );
}

export const Bubble = memo(function Bubble({ item, body, keyBytes, me, reply, onReply, onLongPress, onDoubleTap, onProofVoice }: BubbleProps) {
  const s = useStrings();
  const pager = usePager();
  const reduce = useReducedMotion();
  const x = useSharedValue(0);
  const armed = useSharedValue(false);
  const { row, mine, status } = item;
  const dead = isTombstone(row);
  const t = body?.t;

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX(REPLY_DIR > 0 ? [-9999, 18] : [-18, 9999])
      .failOffsetX(REPLY_DIR > 0 ? [-10, 9999] : [-9999, 10])
      .failOffsetY([-12, 12])
      .blocksExternalGesture(pager.gesture)
      .onUpdate((e) => {
        const v = Math.max(0, e.translationX * REPLY_DIR);
        x.value = REPLY_DIR * (v > THRESHOLD ? THRESHOLD + (v - THRESHOLD) * 0.2 : v);
        if (v > THRESHOLD && !armed.value) {
          armed.value = true;
          runOnJS(haptic.tap)();
        } else if (v <= THRESHOLD && armed.value) armed.value = false;
      })
      .onEnd(() => {
        if (armed.value) runOnJS(onReply)(item.id);
        armed.value = false;
        x.value = withSpring(0, springs.snappy);
      });
    const dbl = Gesture.Tap().numberOfTaps(2).maxDuration(250).onEnd(() => runOnJS(onDoubleTap)(item));
    const lp = Gesture.LongPress().minDuration(380).onStart(() => runOnJS(onLongPress)(item));
    return Gesture.Exclusive(pan, lp, dbl);
  }, [pager.gesture, x, armed, onReply, onDoubleTap, onLongPress, item]);

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(x.value), [10, THRESHOLD], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(Math.abs(x.value), [10, THRESHOLD], [0.5, 1], 'clamp') }],
  }));

  if (body && isCentered(body.t) && !dead) {
    return <View style={styles.centerRow}><SpecialCard item={item} body={body} onProofVoice={onProofVoice} /></View>;
  }

  const isMedia = t === 'image' || t === 'video';
  const card = !dead && body && isCard(body.t);
  let content: React.ReactNode;
  if (dead) content = <Txt variant="small" muted style={styles.italic}>{s.chat.deleted}</Txt>;
  else if (!body) content = <Txt variant="small" muted>{s.chat.cantDecrypt}</Txt>;
  else if (body.t === 'text') content = <Txt color={colors.text} selectable={false}>{body.text}</Txt>;
  else if (body.t === 'image') content = <EncryptedImage id={row.id} path={row.media_path} nonce={row.media_nonce} mime={body.mime} w={body.w} h={body.h} keyBytes={keyBytes} />;
  else if (body.t === 'video') content = <VideoThumb id={row.id} path={row.media_path} nonce={row.media_nonce} mime={body.mime} duration={body.duration} />;
  else if (body.t === 'voice') content = <VoiceNote id={row.id} path={row.media_path} nonce={row.media_nonce} duration={body.duration} waveform={body.waveform} keyBytes={keyBytes} mine={mine} />;
  else content = <SpecialCard item={item} body={body} onProofVoice={onProofVoice} />;

  const plain = isMedia || card;
  const r = radius.lg;
  const tailCorner = mine ? { borderBottomEndRadius: item.groupEnd ? 6 : r } : { borderBottomStartRadius: item.groupEnd ? 6 : r };
  const groupCorner = mine ? { borderTopEndRadius: item.groupStart ? r : 6 } : { borderTopStartRadius: item.groupStart ? r : 6 };

  return (
    <Animated.View entering={reduce || status === 'sent' ? undefined : FadeInUp.springify().damping(18)} style={[styles.row, item.groupEnd ? styles.gapBig : styles.gapSmall]}>
      <Animated.View style={[styles.replyIcon, styles.iconStart, iconStyle]}>
        <Ionicons name="arrow-undo" size={18} color={colors.textMuted} />
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.col, mine ? styles.mine : styles.theirs, rowStyle]}>
          {reply ? (
            <View style={[styles.quote, mine ? styles.quoteMine : null]}>
              <Txt variant="tiny" color={colors.rose}>{reply.author}</Txt>
              <Txt variant="small" muted numberOfLines={1}>{reply.text}</Txt>
            </View>
          ) : null}
          <View
            style={[
              plain ? styles.plain : styles.bubble,
              !plain && (mine ? styles.bubbleMine : styles.bubbleTheirs),
              !plain && tailCorner,
              !plain && groupCorner,
              status !== 'sent' && styles.pending,
            ]}
          >
            {content}
          </View>
          <Reactions list={item.reactions} mine={mine} />
          {(item.groupEnd || status !== 'sent' || item.showSeen) && (
            <View style={[styles.meta, mine ? styles.metaMine : null]}>
              {row.disappear_mode !== 'off' ? <Ionicons name="timer-outline" size={11} color={colors.textFaint} /> : null}
              {status === 'sending' ? <Txt variant="tiny" muted>{s.chat.sending}</Txt> : null}
              {status === 'failed' ? (
                <Pressy onPress={() => flush()} hapticStyle="tap"><Txt variant="tiny" color={colors.danger}>{s.chat.failed}</Txt></Pressy>
              ) : null}
              {status === 'sent' && item.groupEnd ? <Txt variant="tiny" color={colors.textFaint}>{time(row.created_at)}</Txt> : null}
              {item.showSeen && row.sender_id === me ? <Txt variant="tiny" color={colors.rose}>· {s.chat.seen}</Txt> : null}
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: { paddingHorizontal: space.md, justifyContent: 'center' },
  gapSmall: { marginTop: 2 },
  gapBig: { marginTop: 2, marginBottom: 8 },
  centerRow: { alignItems: 'center', marginVertical: space.sm, paddingHorizontal: space.md },
  col: { maxWidth: '80%' },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.lg },
  plain: {},
  bubbleMine: { backgroundColor: colors.bubbleMine },
  bubbleTheirs: { backgroundColor: colors.bubbleTheirs, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  pending: { opacity: 0.7 },
  italic: { fontStyle: 'italic' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, paddingHorizontal: 4 },
  metaMine: { alignSelf: 'flex-end' },
  quote: { borderStartWidth: 3, borderStartColor: colors.rose, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 2, backgroundColor: colors.surface, borderRadius: 8, maxWidth: 260 },
  quoteMine: { alignSelf: 'flex-end' },
  reactions: { flexDirection: 'row', marginTop: -8, backgroundColor: colors.bgElevated, borderRadius: radius.pill, paddingHorizontal: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, zIndex: 2 },
  reactMine: { alignSelf: 'flex-start', marginStart: 8 },
  reactTheirs: { alignSelf: 'flex-end', marginEnd: 8 },
  reactEmoji: { fontSize: 14, lineHeight: 22 },
  replyIcon: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  iconStart: { start: space.md },
});
