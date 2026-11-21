/** Camera → editor → send. Used by the Camera page and the compose modal. */
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSession } from '@/lib/session';
import { useStrings } from '@/lib/i18n';
import { Txt } from '@/components/Txt';
import { colors } from '@/lib/theme';
import { SnapCamera } from './SnapCamera';
import { SnapEditor } from './SnapEditor';
import { sendSnap, uploadSnap, type Capture, type SnapOptions } from './sendSnap';
import { uuid } from '@/lib/ids';

type Props = {
  active: boolean;
  topInset: number;
  bottomInset: number;
  accessory?: React.ReactNode;
  onEditingChange?: (editing: boolean) => void;
  /** dare message id: the snap proves it (awaited, then onSent) */
  proofFor?: string | null;
  editorTitle?: string;
  onSent?: (messageId: string | null) => void;
};

export function SnapStudio({ active, topInset, bottomInset, accessory, onEditingChange, proofFor, editorTitle, onSent }: Props) {
  const s = useStrings();
  const { couple, userId, sharedKey, partner } = useSession();
  const [capture, setCapture] = useState<Capture | null>(null);
  const [noKey, setNoKey] = useState(false);

  const open = useCallback((c: Capture) => {
    setCapture(c);
    onEditingChange?.(true);
  }, [onEditingChange]);
  const close = useCallback(() => {
    setCapture(null);
    onEditingChange?.(false);
  }, [onEditingChange]);

  const send = async (opts: Omit<SnapOptions, 'proofFor'>) => {
    if (!capture || !couple || !userId) return;
    if (!sharedKey) {
      setNoKey(true);
      return;
    }
    const ctx = { coupleId: couple.id, userId, key: sharedKey };
    const cap = capture;
    close();
    if (proofFor) {
      // proof: wait for the real upload so the dare can be marked done
      try {
        const id = await uploadSnap(ctx, cap, { ...opts, proofFor }, uuid());
        onSent?.(id);
      } catch {
        onSent?.(null);
      }
      return;
    }
    const id = await sendSnap(ctx, cap, opts);
    onSent?.(id);
  };

  return (
    <View style={styles.root}>
      <SnapCamera active={active && !capture} onCapture={open} topInset={topInset} bottomInset={bottomInset} accessory={accessory} />
      {capture && (
        <SnapEditor capture={capture} partnerName={partner?.display_name || s.common.partner} onDiscard={close} onSend={send} title={editorTitle} />
      )}
      {noKey && (
        <View style={styles.noKey}>
          <Txt center color={colors.warning}>{s.states.noPartnerKey}</Txt>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  noKey: { position: 'absolute', top: '45%', start: 24, end: 24, backgroundColor: 'rgba(0,0,0,0.7)', padding: 16, borderRadius: 16 },
});
