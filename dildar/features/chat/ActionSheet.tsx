/** Long-press overlay: quick reactions + reply / copy / delete. */
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Txt } from '@/components/Txt';
import { Pressy } from '@/components/Pressy';
import { ListRow, Divider } from '@/components/ListRow';
import { colors, radius, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';
import type { MessageBody } from '@/lib/messages';
import type { MsgItem } from './model';

export const QUICK_REACTIONS = ['❤️', '😂', '😍', '🔥', '😮', '😢', '👍'];

export function ActionSheet({ item, body, myReaction, onClose, onReact, onReply, onDelete }: {
  item: MsgItem | null;
  body: MessageBody | null;
  myReaction: string | null;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onDelete: () => void;
}) {
  const s = useStrings();
  if (!item) return null;
  const dead = !!item.row.deleted_at;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(120)} style={StyleSheet.absoluteFill}>
          <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
        </Animated.View>
      </Pressable>
      <View style={styles.center} pointerEvents="box-none">
        {!dead && item.status === 'sent' ? (
          <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.reactions}>
            {QUICK_REACTIONS.map((e) => (
              <Pressy key={e} onPress={() => { onReact(e); onClose(); }} hapticStyle="select" style={[styles.emojiBtn, myReaction === e && styles.emojiOn]}>
                <Txt style={styles.emoji}>{e}</Txt>
              </Pressy>
            ))}
          </Animated.View>
        ) : null}
        <Animated.View entering={FadeIn.delay(60)} style={styles.menu}>
          {!dead ? <ListRow icon="arrow-undo-outline" title={s.chat.reply} onPress={() => { onReply(); onClose(); }} /> : null}
          {!dead && body?.t === 'text' ? (
            <>
              <Divider />
              <ListRow icon="copy-outline" title={s.chat.copy} onPress={async () => { await Clipboard.setStringAsync(body.text); haptic.success(); onClose(); }} />
            </>
          ) : null}
          {item.mine && !dead && item.status === 'sent' ? (
            <>
              <Divider />
              <ListRow icon="trash-outline" title={s.chat.deleteForBoth} danger onPress={() => { onClose(); onDelete(); }} />
            </>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.lg, padding: space.xl },
  reactions: { flexDirection: 'row', gap: 4, backgroundColor: colors.bgElevated, borderRadius: radius.pill, padding: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  emojiBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emojiOn: { backgroundColor: colors.surfaceStrong },
  emoji: { fontSize: 26, lineHeight: 34 },
  menu: { alignSelf: 'stretch', backgroundColor: colors.bgElevated, borderRadius: radius.xl, paddingHorizontal: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
