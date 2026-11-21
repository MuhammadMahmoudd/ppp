/** Vault (گەنجینە): encrypted photos/videos/voice notes we both chose to keep. */
import React, { useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Platform, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { Button } from '@/components/Button';
import { Glass } from '@/components/Glass';
import { Txt } from '@/components/Txt';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { colors, space } from '@/lib/theme';
import { fmt, useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { haptic } from '@/lib/haptics';
import { notifyPartner } from '@/lib/push';
import { Chip } from '@/features/profile/ProfileForm';
import { useScreenGuard } from '@/features/security/useScreenGuard';
import { useVault } from './useVault';
import { VaultThumb } from './VaultThumb';
import { VoiceRecorder } from './VoiceRecorder';
import { addFromLibrary, addVaultFile, cancelDeleteRequest, createAlbum, deleteVaultItem } from './actions';

const GAP = 4;
const COLS = 3;

export function VaultHome() {
  const s = useStrings();
  const { couple, userId, sharedKey } = useSession();
  const { width } = useWindowDimensions();
  const { items, albums, requests, error, reload } = useVault(couple?.id ?? null, sharedKey);
  const [album, setAlbum] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [voice, setVoice] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useScreenGuard('vault');

  const ctx = couple && sharedKey ? { coupleId: couple.id, key: sharedKey } : null;
  const tile = Math.floor((width - space.lg * 2 - GAP * (COLS - 1)) / COLS);
  const visible = useMemo(() => (items ?? []).filter((i) => !album || i.album_id === album), [items, album]);
  const pendingIds = useMemo(() => new Set(requests.map((r) => r.item_id)), [requests]);
  const partnerRequests = requests.filter((r) => r.requested_by !== userId);

  const runAdd = async (fn: () => Promise<unknown>) => {
    setBusy(s.vault.uploading);
    try {
      await fn();
      haptic.success();
      await reload();
    } catch {
      haptic.error();
      Alert.alert(s.states.errorTitle, s.states.errorBody);
    } finally {
      setBusy(null);
    }
  };

  const add = () => {
    if (!ctx) return;
    const media = () => runAdd(() => addFromLibrary(ctx, album));
    const rec = () => setVoice(true);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [s.vault.addMedia, s.vault.addVoice, s.common.cancel], cancelButtonIndex: 2, userInterfaceStyle: 'dark' },
        (i) => (i === 0 ? media() : i === 1 ? rec() : undefined),
      );
    } else {
      Alert.alert(s.vault.add, undefined, [
        { text: s.vault.addMedia, onPress: media },
        { text: s.vault.addVoice, onPress: rec },
        { text: s.common.cancel, style: 'cancel' },
      ]);
    }
  };

  const newAlbum = () => {
    if (!ctx) return;
    const create = (name?: string) => name?.trim() && runAdd(() => createAlbum(ctx, name));
    if (Platform.OS === 'ios') Alert.prompt(s.vault.newAlbum, s.vault.albumName, create);
    else create(`${s.vault.newAlbum} ${albums.length + 1}`);
  };

  const agree = (itemId: string) =>
    Alert.alert(s.vault.deleteConfirm, undefined, [
      { text: s.vault.keep, style: 'cancel', onPress: () => cancelDeleteRequest(itemId).then(reload) },
      { text: s.vault.agreeDelete, style: 'destructive', onPress: () => runAdd(() => deleteVaultItem(itemId)) },
    ]);

  const header = (
    <View style={styles.headerBlock}>
      {couple?.vault_delete_protection && (
        <Txt variant="tiny" muted center>🔐 {s.vault.protectionOn}</Txt>
      )}
      {partnerRequests.length > 0 && (
        <Animated.View entering={FadeInDown}>
          <Glass style={styles.request}>
            <Ionicons name="trash-outline" size={20} color={colors.warning} />
            <Txt style={styles.flex}>{fmt(s.vault.partnerWantsDelete, { n: partnerRequests.length })}</Txt>
            <Button small variant="danger" title={s.vault.agreeDelete} onPress={() => agree(partnerRequests[0].item_id)} />
          </Glass>
        </Animated.View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label={s.vault.all} active={!album} onPress={() => setAlbum(null)} />
        {albums.map((a) => <Chip key={a.id} label={a.name} active={album === a.id} onPress={() => setAlbum(a.id)} />)}
        <Chip label={`+ ${s.vault.newAlbum}`} active={false} onPress={newAlbum} />
      </ScrollView>
      {busy && <Txt variant="small" muted center>{busy}</Txt>}
    </View>
  );

  return (
    <Screen
      header={<Header title={s.vault.title} right={<IconButton name="add" label={s.vault.add} onPress={add} />} />}
    >
      {error ? (
        <ErrorState onRetry={reload} />
      ) : !items ? (
        <View style={styles.skeletons}>
          {Array.from({ length: 12 }, (_, i) => <Skeleton key={i} width={tile} height={tile} />)}
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(i) => i.id}
          numColumns={COLS}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
          refreshControl={<RefreshControl tintColor={colors.rose} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} />}
          ListEmptyComponent={
            <EmptyState emoji="🔒" title={s.vault.empty} body={s.vault.emptyBody} action={{ label: s.vault.add, onPress: add }} />
          }
          renderItem={({ item }) => (
            <VaultThumb
              item={item}
              size={tile}
              keyBytes={sharedKey}
              pending={pendingIds.has(item.id)}
              onOpen={() => router.push({ pathname: '/vault/[id]', params: { id: item.id } })}
            />
          )}
          ListFooterComponent={visible.length ? <Txt variant="tiny" muted center style={styles.footer}>{s.vault.holdToPeek}</Txt> : undefined}
        />
      )}
      <VoiceRecorder
        visible={voice}
        onClose={() => setVoice(false)}
        onDone={(uri, ms) => {
          setVoice(false);
          if (ctx) runAdd(async () => {
            await addVaultFile(ctx, uri, 'voice', { mime: 'audio/mp4', ext: 'm4a', duration: Math.round(ms / 1000) }, album);
            notifyPartner('vault');
          });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerBlock: { gap: space.md, paddingBottom: space.md },
  request: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  chips: { gap: space.sm },
  list: { padding: space.lg, paddingBottom: space.xxl * 2 },
  row: { gap: GAP, marginBottom: GAP },
  skeletons: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, padding: space.lg },
  footer: { marginTop: space.lg },
});
