/**
 * Chat tab (Phase 2). Inverted FlashList v2 driven by keyboard-controller's
 * KeyboardChatScrollView, composer pinned with KeyboardStickyView above the
 * floating bottom nav. Optimistic outbox + realtime + E2E decryption.
 */
import React, { forwardRef, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { KeyboardChatScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from '@/components/Txt';
import { Pressy } from '@/components/Pressy';
import { EmptyState, ErrorState, SkeletonList } from '@/components/States';
import { colors, radius, space } from '@/lib/theme';
import { num, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useChromeInsets } from '@/features/home/chrome';
import { CountdownHeader } from '@/features/closeness/CountdownHeader';
import { useChat } from './useChat';
import { Bubble } from './Bubble';
import { ChatHeader } from './ChatHeader';
import { Composer, type ReplyTarget } from './Composer';
import { ActionSheet } from './ActionSheet';
import { confirmDelete, dismissUpload, react, useUploads, type ChatCtx } from './actions';
import { previewText } from './preview';
import type { ChatItem, MsgItem } from './model';

function dayLabel(day: string, s: ReturnType<typeof useStrings>): string {
  const d = new Date();
  const fmtDay = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (day === fmtDay(d)) return s.chat.today;
  d.setDate(d.getDate() - 1);
  if (day === fmtDay(d)) return s.chat.yesterday;
  return num(day.replace(/-/g, '/'));
}

function UploadsRow() {
  const s = useStrings();
  const uploads = useUploads();
  if (!uploads.length) return null;
  return (
    <View style={styles.uploads}>
      {uploads.map((u) => (
        <View key={u.id} style={styles.upload}>
          {u.kind === 'image' ? (
            <Image source={{ uri: u.uri }} style={styles.uploadThumb} contentFit="cover" />
          ) : (
            <View style={[styles.uploadThumb, styles.center]}>
              <Ionicons name={u.kind === 'video' ? 'videocam' : 'mic'} size={22} color={colors.textMuted} />
            </View>
          )}
          <View style={[StyleSheet.absoluteFill, styles.center, styles.uploadShade]}>
            {u.failed ? (
              <View style={styles.uploadActions}>
                <Pressy onPress={u.retry} accessibilityLabel={s.common.retry}><Ionicons name="refresh" size={22} color={colors.text} /></Pressy>
                <Pressy onPress={() => dismissUpload(u.id)} accessibilityLabel={s.common.cancel}><Ionicons name="close" size={22} color={colors.text} /></Pressy>
              </View>
            ) : (
              <ActivityIndicator color={colors.text} />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

export function ChatHome({ active }: { active: boolean }) {
  const s = useStrings();
  const { couple, userId, partner, sharedKey } = useSession();
  const { top, bottom } = useChromeInsets();
  const chat = useChat(couple?.id ?? '', userId ?? '', sharedKey, active);
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const [proofFor, setProofFor] = useState<string | null>(null);
  const [sheet, setSheet] = useState<MsgItem | null>(null);
  const [composerH, setComposerH] = useState(64);

  const ctx: ChatCtx | null = couple && userId && sharedKey ? { coupleId: couple.id, userId, key: sharedKey } : null;
  const authorName = useCallback((senderId: string) => (senderId === userId ? s.chat.replyYou : partner?.display_name ?? s.common.partner), [userId, partner, s]);

  const onReply = useCallback(
    (id: string) => {
      const r = chat.findRow(id);
      if (!r) return;
      setReply({ id, author: authorName(r.sender_id), text: previewText(chat.decrypt(r), s) });
    },
    [chat, authorName, s],
  );
  const onDoubleTap = useCallback(
    (item: MsgItem) => {
      if (!ctx || item.status !== 'sent' || item.row.deleted_at) return;
      const mine = item.reactions.find((r) => r.user_id === userId)?.emoji ?? null;
      react(ctx, item.id, '❤️', mine);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx?.coupleId, ctx?.key, userId],
  );
  const onLongPress = useCallback((item: MsgItem) => setSheet(item), []);

  // Inverted list + keyboard-aware chat scroll view.
  const ScrollComponent = useMemo(
    () =>
      forwardRef<React.ComponentRef<typeof KeyboardChatScrollView>, ScrollViewProps>(function ChatScroll(props, ref) {
        return <KeyboardChatScrollView ref={ref} {...props} inverted offset={bottom} keyboardLiftBehavior="always" />;
      }),
    [bottom],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ChatItem>) => {
      if (item.kind === 'day') {
        return (
          <View style={styles.day}>
            <Txt variant="tiny" muted>{dayLabel(item.day, s)}</Txt>
          </View>
        );
      }
      const body = chat.decrypt(item.row);
      const replyRow = item.row.reply_to ? chat.findRow(item.row.reply_to) : undefined;
      const replyInfo = replyRow ? { author: authorName(replyRow.sender_id), text: previewText(chat.decrypt(replyRow), s) } : null;
      return (
        <Bubble
          item={item}
          body={body}
          keyBytes={sharedKey}
          me={userId ?? ''}
          reply={replyInfo}
          onReply={onReply}
          onLongPress={onLongPress}
          onDoubleTap={onDoubleTap}
          onProofVoice={setProofFor}
        />
      );
    },
    [chat, s, sharedKey, userId, authorName, onReply, onLongPress, onDoubleTap],
  );

  const sheetBody = sheet ? chat.decrypt(sheet.row) : null;
  const myReaction = sheet?.reactions.find((r) => r.user_id === userId)?.emoji ?? null;
  const msgCount = chat.items.length;

  let body: React.ReactNode;
  if (!sharedKey) body = <EmptyState emoji="🔑" title={s.states.noPartnerKey} />;
  else if (chat.loading) body = <SkeletonList rows={7} />;
  else if (chat.error && !msgCount) body = <ErrorState onRetry={chat.reload} />;
  else {
    body = (
      <FlashList
        data={chat.items}
        renderItem={renderItem}
        keyExtractor={(i) => i.id}
        getItemType={(i) => (i.kind === 'day' ? 'day' : i.row.type)}
        inverted
        renderScrollComponent={ScrollComponent}
        onEndReached={chat.loadOlder}
        onEndReachedThreshold={0.4}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        drawDistance={600}
        maintainVisibleContentPosition={{ autoscrollToBottomThreshold: 0.2 }}
        ListHeaderComponent={
          <View style={{ paddingBottom: composerH + space.sm }}>
            <UploadsRow />
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {chat.loadingMore ? <ActivityIndicator color={colors.textMuted} /> : null}
            {!chat.hasMore || msgCount === 0 ? <CountdownHeader /> : null}
            {msgCount === 0 ? <EmptyState emoji="💌" title={s.chat.empty} body={s.chat.emptyBody} /> : null}
          </View>
        }
      />
    );
  }

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <ChatHeader partner={partner} typing={chat.partnerTyping} mode={couple?.chat_disappear_mode ?? 'off'} />
      <View style={styles.flex}>{body}</View>
      <KeyboardStickyView offset={{ closed: 0, opened: bottom }} style={[styles.composer, { bottom }]}>
        <View onLayout={(e) => setComposerH(e.nativeEvent.layout.height)}>
          <Composer
            ctx={ctx}
            disappearDefault={couple?.chat_disappear_mode ?? 'off'}
            reply={reply}
            onCancelReply={() => setReply(null)}
            proofFor={proofFor}
            onClearProof={() => setProofFor(null)}
          />
        </View>
      </KeyboardStickyView>
      <ActionSheet
        item={sheet}
        body={sheetBody}
        myReaction={myReaction}
        onClose={() => setSheet(null)}
        onReact={(e) => ctx && sheet && react(ctx, sheet.id, e, myReaction)}
        onReply={() => sheet && onReply(sheet.id)}
        onDelete={() => sheet && confirmDelete(sheet.id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  composer: { position: 'absolute', start: 0, end: 0 },
  day: { alignSelf: 'center', marginVertical: space.md, paddingHorizontal: space.md, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surface },
  footer: { paddingTop: space.lg, gap: space.md },
  uploads: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm },
  upload: { width: 110, height: 140, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  uploadThumb: { width: '100%', height: '100%' },
  uploadShade: { backgroundColor: 'rgba(0,0,0,0.35)' },
  uploadActions: { flexDirection: 'row', gap: space.lg },
  center: { alignItems: 'center', justifyContent: 'center' },
});
