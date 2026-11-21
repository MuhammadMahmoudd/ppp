import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/lib/theme';
import { Pager, type PageName } from '@/features/home/Pager';
import { TopBar } from '@/features/home/TopBar';
import { BottomNav } from '@/features/home/BottomNav';
import { ChatHome } from '@/features/chat/ChatHome';
import { CameraScreen } from '@/features/snaps/CameraScreen';
import { GamesHome } from '@/features/games/GamesHome';
import { MilestoneCelebration } from '@/features/streaks/MilestoneCelebration';
import { OfflineBanner } from '@/components/States';

function renderPage(p: PageName, active: boolean) {
  if (p === 'chat') return <ChatHome active={active} />;
  if (p === 'camera') return <CameraScreen active={active} />;
  return <GamesHome active={active} />;
}

/** Home: Chat ← Camera → Games. */
export default function Home() {
  return (
    <View style={styles.root}>
      <Pager render={renderPage} initial="camera" />
      <TopBar />
      <BottomNav />
      <View style={styles.offline} pointerEvents="none"><OfflineBanner /></View>
      <MilestoneCelebration />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  offline: { position: 'absolute', top: 110, start: 0, end: 0, zIndex: 60 },
});
