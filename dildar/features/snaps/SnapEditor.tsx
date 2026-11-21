/**
 * Edit before sending: doodle, Kurdish (RTL) text, filters, spicy blur,
 * timer 3/5/10/∞, view-once (default) and "allow save". Nothing is burned
 * into the media; the overlay is sent as encrypted JSON.
 */
import React, { useCallback, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown, FadeOut, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { IconButton } from '@/components/IconButton';
import { Pressy } from '@/components/Pressy';
import { Txt } from '@/components/Txt';
import { colors, fonts, gradients, radius, space } from '@/lib/theme';
import { fmt, num, useStrings } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';
import { uuid } from '@/lib/ids';
import { FilterLayer, Strokes, TextBubble, textPosition } from './OverlayView';
import { FILTERS, PALETTE, TIMERS, type SnapOverlay, type SnapTimer, type Stroke, type TextItem } from './overlay';
import type { Capture, SnapOptions } from './sendSnap';

type Tool = 'none' | 'draw' | 'text';

type Props = {
  capture: Capture;
  partnerName: string;
  onDiscard: () => void;
  onSend: (opts: Omit<SnapOptions, 'proofFor'>) => void;
  title?: string;
};

function MediaPreview({ capture }: { capture: Capture }) {
  if (capture.kind === 'video') return <VideoPreview uri={capture.uri} />;
  return <Image source={{ uri: capture.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />;
}

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

export function SnapEditor({ capture, partnerName, onDiscard, onSend, title }: Props) {
  const s = useStrings();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tool, setTool] = useState<Tool>('none');
  const [color, setColor] = useState<string>(PALETTE[1]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [live, setLive] = useState<Stroke | null>(null);
  const liveRef = useRef<number[]>([]);
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [editing, setEditing] = useState<TextItem | null>(null);
  const [filterIdx, setFilterIdx] = useState(0);
  const [duration, setDuration] = useState<SnapTimer>(5);
  const [viewOnce, setViewOnce] = useState(true);
  const [allowSave, setAllowSave] = useState(false);
  const [spicyBlur, setSpicyBlur] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const filter = FILTERS[filterIdx];

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast((c) => (c === t ? null : c)), 1200);
  };

  // ── drawing ──
  const addPoint = useCallback((x: number, y: number, first: boolean) => {
    if (first) liveRef.current = [];
    liveRef.current.push(x, y);
    setLive({ color, width: 7, points: [...liveRef.current] });
  }, [color]);
  const endStroke = useCallback(() => {
    const pts = liveRef.current;
    if (pts.length >= 2) setStrokes((st) => [...st, { color, width: 7, points: [...pts] }]);
    liveRef.current = [];
    setLive(null);
  }, [color]);

  const w = size.w || 1;
  const h = size.h || 1;
  const draw = Gesture.Pan()
    .enabled(tool === 'draw')
    .minDistance(0)
    .onBegin((e) => runOnJS(addPoint)(e.x / w, e.y / h, true))
    .onUpdate((e) => runOnJS(addPoint)(e.x / w, e.y / h, false))
    .onFinalize(() => runOnJS(endStroke)());

  // ── text ──
  const startText = () => {
    haptic.tap();
    setTool('text');
    setEditing({ id: uuid(), text: '', x: 0.5, y: 0.42, color: '#FFFFFF', size: 30, bg: true });
  };
  const commitText = () => {
    if (editing) {
      const t = editing.text.trim();
      setTexts((all) => {
        const rest = all.filter((x) => x.id !== editing.id);
        return t ? [...rest, { ...editing, text: t }] : rest;
      });
    }
    setEditing(null);
    setTool('none');
  };
  const moveText = useCallback((id: string, x: number, y: number) => {
    setTexts((all) => all.map((t) => (t.id === id ? { ...t, x: Math.min(0.98, Math.max(0.02, x)), y: Math.min(0.95, Math.max(0.05, y)) } : t)));
  }, []);

  const undo = () => {
    haptic.tap();
    if (strokes.length) setStrokes((st) => st.slice(0, -1));
    else if (texts.length) setTexts((t) => t.slice(0, -1));
  };

  const discard = () => {
    if (!strokes.length && !texts.length) return onDiscard();
    Alert.alert(s.snaps.discardConfirm, undefined, [
      { text: s.common.cancel, style: 'cancel' },
      { text: s.snaps.discard, style: 'destructive', onPress: onDiscard },
    ]);
  };

  const send = () => {
    haptic.send();
    const overlay: SnapOverlay = { strokes, texts, filter };
    onSend({ overlay, duration, viewOnce, allowSave, spicyBlur });
  };

  const timerLabel = duration === 0 ? s.snaps.timerLoop : `${num(duration)}s`;

  return (
    <Animated.View entering={FadeIn.duration(150)} style={[StyleSheet.absoluteFill, styles.root]}>
      <GestureDetector gesture={draw}>
        <View style={[StyleSheet.absoluteFill, styles.ltr]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          <MediaPreview capture={capture} />
          <FilterLayer filter={filter} />
          {spicyBlur && <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />}
          <Strokes strokes={strokes} width={size.w} height={size.h} live={live} />
          {texts.filter((t) => t.id !== editing?.id).map((t) => (
            <DraggableText key={t.id} item={t} width={size.w} height={size.h} enabled={tool !== 'draw'} onMove={moveText} onEdit={() => { setTool('text'); setEditing(t); }} />
          ))}
        </View>
      </GestureDetector>

      {/* top tools */}
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <IconButton name="close" label={s.snaps.discard} onPress={discard} />
        {title ? <Txt variant="heading">{title}</Txt> : <View />}
        <View style={styles.toolCol}>
          <IconButton name="text" label={s.snaps.text} onPress={startText} color={tool === 'text' ? colors.accent : colors.text} />
          <IconButton name="brush" label={s.snaps.draw} onPress={() => { haptic.tap(); setTool(tool === 'draw' ? 'none' : 'draw'); }} color={tool === 'draw' ? colors.accent : colors.text} />
          <IconButton name="color-filter-outline" label={s.snaps.filter} onPress={() => { haptic.select(); const n = (filterIdx + 1) % FILTERS.length; setFilterIdx(n); flash(s.snaps.filters[FILTERS[n]]); }} />
          <IconButton name="flame-outline" label={s.snaps.spicyBlur} onPress={() => { haptic.select(); setSpicyBlur(!spicyBlur); flash(spicyBlur ? s.snaps.filters.none : s.snaps.spicyBlurHint); }} color={spicyBlur ? colors.coral : colors.text} />
          {(strokes.length > 0 || texts.length > 0) && <IconButton name="arrow-undo" label={s.snaps.undo} onPress={undo} flipRTL />}
        </View>
      </View>

      {tool === 'draw' && (
        <Animated.View entering={FadeInDown} style={[styles.palette, { top: insets.top + 64 }]}>
          {PALETTE.map((c) => (
            <Pressable key={c} onPress={() => { haptic.select(); setColor(c); }} accessibilityLabel={c} style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchOn]} />
          ))}
        </Animated.View>
      )}

      {toast && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.toast} pointerEvents="none">
          <Txt variant="heading">{toast}</Txt>
        </Animated.View>
      )}

      {/* bottom options + send */}
      {tool !== 'text' && (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <OptionChip icon="timer-outline" label={`${s.snaps.timer} ${timerLabel}`} on onPress={() => setDuration(TIMERS[(TIMERS.indexOf(duration) + 1) % TIMERS.length])} />
            <OptionChip icon={viewOnce ? 'eye-off-outline' : 'repeat'} label={viewOnce ? s.snaps.viewOnce : s.snaps.replayable} on={viewOnce} onPress={() => setViewOnce(!viewOnce)} />
            <OptionChip icon={allowSave ? 'bookmark' : 'bookmark-outline'} label={allowSave ? s.snaps.allowSave : s.snaps.noSave} on={allowSave} onPress={() => setAllowSave(!allowSave)} />
            {spicyBlur && <OptionChip icon="flame" label={s.snaps.spicyBlur} on onPress={() => setSpicyBlur(false)} />}
          </ScrollView>
          <Pressy onPress={send} hapticStyle="none" accessibilityLabel={fmt(s.snaps.sendTo, { name: partnerName })}>
            <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.send}>
              <Txt variant="heading">{fmt(s.snaps.sendTo, { name: partnerName })}</Txt>
              <Ionicons name="paper-plane" size={20} color={colors.text} />
            </LinearGradient>
          </Pressy>
        </View>
      )}

      {editing && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[StyleSheet.absoluteFill, styles.textEditor]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={commitText} />
          <TextInput
            autoFocus
            multiline
            value={editing.text}
            onChangeText={(text) => setEditing({ ...editing, text })}
            placeholder={s.snaps.textPlaceholder}
            placeholderTextColor="rgba(255,255,255,0.5)"
            keyboardAppearance="dark"
            maxLength={240}
            style={[styles.textInput, { color: editing.color, fontSize: editing.size }]}
            onBlur={commitText}
          />
          <View style={styles.textTools}>
            {PALETTE.map((c) => (
              <Pressable key={c} onPress={() => setEditing({ ...editing, color: c })} style={[styles.swatchSm, { backgroundColor: c }, editing.color === c && styles.swatchOn]} />
            ))}
            <IconButton name={editing.bg ? 'square' : 'square-outline'} label="bg" onPress={() => setEditing({ ...editing, bg: !editing.bg })} />
            <IconButton name="checkmark" label={s.common.done} onPress={commitText} color={colors.success} />
          </View>
        </KeyboardAvoidingView>
      )}
    </Animated.View>
  );
}

function DraggableText({ item, width, height, enabled, onMove, onEdit }: { item: TextItem; width: number; height: number; enabled: boolean; onMove: (id: string, x: number, y: number) => void; onEdit: () => void }) {
  const start = useRef({ x: item.x, y: item.y });
  const pan = Gesture.Pan()
    .enabled(enabled)
    .onBegin(() => runOnJS(setStart)())
    .onUpdate((e) => runOnJS(move)(e.translationX, e.translationY));
  const tap = Gesture.Tap().enabled(enabled).onEnd((_e, ok) => ok && runOnJS(onEdit)());
  function setStart() {
    start.current = { x: item.x, y: item.y };
  }
  function move(dx: number, dy: number) {
    onMove(item.id, start.current.x + dx / (width || 1), start.current.y + dy / (height || 1));
  }
  if (!width) return null;
  return (
    <View style={[styles.textRow, textPosition(item.x, item.y, item.size, width, height)]} pointerEvents="box-none">
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View>
          <TextBubble text={item.text} color={item.color} size={item.size} bg={item.bg} />
        </View>
      </GestureDetector>
    </View>
  );
}

function OptionChip({ icon, label, on, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressy onPress={onPress} hapticStyle="select" style={[styles.chip, on && styles.chipOn]}>
      <Ionicons name={icon} size={16} color={colors.text} />
      <Txt variant="small">{label}</Txt>
    </Pressy>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#000', zIndex: 80 },
  ltr: { direction: 'ltr' },
  top: { position: 'absolute', top: 0, start: 0, end: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: space.lg },
  toolCol: { gap: space.md, alignItems: 'center' },
  palette: { position: 'absolute', start: space.lg, gap: 10, padding: 8, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.35)' },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  swatchSm: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  swatchOn: { borderColor: '#fff', transform: [{ scale: 1.2 }] },
  toast: { position: 'absolute', top: '45%', alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill },
  bottom: { position: 'absolute', bottom: 0, start: 0, end: 0, gap: space.md, paddingHorizontal: space.lg },
  chips: { gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipOn: { backgroundColor: 'rgba(255,77,109,0.55)', borderColor: colors.accent },
  send: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 56, borderRadius: radius.lg },
  textEditor: { backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', gap: space.lg, zIndex: 90 },
  textInput: { fontFamily: fonts.bold, textAlign: 'center', minWidth: 120, maxWidth: '90%', writingDirection: 'auto' },
  textTools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  textRow: { position: 'absolute', left: 0, alignItems: 'center' },
});
