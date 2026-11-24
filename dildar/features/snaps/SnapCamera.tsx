/**
 * Camera-first capture surface.
 *  • tap shutter = photo, hold shutter = video (max 30s, progress ring)
 *  • front/back flip (double-tap the preview too), flash, tap to focus, pinch zoom
 * Video needs mode="video": holding the shutter switches mode, waits for the
 * session to be ready, then records. Releasing early cancels gracefully.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, View, Platform } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraMode, type CameraType, type FlashMode, type FocusMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, cancelAnimation, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { colors, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/settings';
import type { Capture } from './sendSnap';

const IS_WEB = Platform.OS === 'web';

const MAX_VIDEO_S = 30;
const SHUTTER = 84;
const RING_R = 38;
const RING_C = 2 * Math.PI * RING_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function useAppActive(): boolean {
  const [a, setA] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setA(st === 'active'));
    return () => sub.remove();
  }, []);
  return a;
}

type Props = {
  active: boolean;
  onCapture: (c: Capture) => void;
  topInset: number;
  bottomInset: number;
  /** extra UI rendered above the shutter (e.g. incoming snaps) */
  accessory?: React.ReactNode;
  /** an outer gesture (the home pager) the shutter must win against */
  blockGesture?: ReturnType<typeof Gesture.Pan>;
  onRecordingChange?: (recording: boolean) => void;
};

export function SnapCamera({ active, onCapture, topInset, bottomInset, accessory, blockGesture, onRecordingChange }: Props) {
  const s = useStrings();
  const reduce = useReducedMotion();
  const appActive = useAppActive();
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const cam = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [mode, setMode] = useState<CameraMode>('picture');
  const [zoom, setZoom] = useState(0);
  const [focus, setFocus] = useState<FocusMode>('on');
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(false);
  const ready = useRef(false);
  const holding = useRef(false);
  const busy = useRef(false);

  // animations
  const ring = useSharedValue(0);
  const shutterScale = useSharedValue(1);
  const focusX = useSharedValue(0);
  const focusY = useSharedValue(0);
  const focusO = useSharedValue(0);
  const focusS = useSharedValue(1.4);
  const zoomStart = useSharedValue(0);
  const zoomSV = useSharedValue(0);

  const live = active && appActive && !!camPerm?.granted;
  const selectHaptic = useCallback(() => haptic.select(), []);
  useEffect(() => onRecordingChange?.(recording), [recording, onRecordingChange]);

  // reset when leaving the page
  useEffect(() => {
    if (!active && recording) cam.current?.stopRecording();
  }, [active, recording]);

  const takePhoto = useCallback(async () => {
    if (!cam.current || busy.current) return;
    busy.current = true;
    haptic.send();
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.75, skipProcessing: false, shutterSound: false });
      if (pic?.uri) onCapture({ uri: pic.uri, kind: 'image', width: pic.width, height: pic.height });
    } catch {
      setError(true);
    } finally {
      busy.current = false;
    }
  }, [onCapture]);

  const startVideo = useCallback(async () => {
    if (!cam.current || busy.current) return;
    if (!micPerm?.granted) {
      const r = await requestMic();
      if (!r.granted) return;
    }
    busy.current = true;
    holding.current = true;
    ready.current = false;
    setMode('video');
    // wait (max ~1.2s) for the session to reconfigure for video
    for (let i = 0; i < 24 && !ready.current; i++) await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 80));
    if (!holding.current || !cam.current) {
      setMode('picture');
      busy.current = false;
      return;
    }
    haptic.heavy();
    setRecording(true);
    ring.value = 0;
    ring.value = withTiming(1, { duration: MAX_VIDEO_S * 1000, easing: Easing.linear });
    try {
      const res = await cam.current.recordAsync({ maxDuration: MAX_VIDEO_S });
      if (res?.uri) onCapture({ uri: res.uri, kind: 'video' });
    } catch {
      setError(true);
    } finally {
      cancelAnimation(ring);
      ring.value = 0;
      setRecording(false);
      setMode('picture');
      busy.current = false;
      holding.current = false;
    }
  }, [micPerm?.granted, requestMic, onCapture, ring]);

  const stopVideo = useCallback(() => {
    holding.current = false;
    if (recording) cam.current?.stopRecording();
  }, [recording]);

  const flip = useCallback(() => {
    if (recording) return;
    haptic.tap();
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
    setZoom(0);
    zoomSV.value = 0;
  }, [recording, zoomSV]);

  const refocus = useCallback(() => {
    setFocus('off');
    setTimeout(() => setFocus('on'), 60);
  }, []);

  const pickFromGallery = useCallback(async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, videoMaxDuration: MAX_VIDEO_S });
    const a = r.canceled ? null : r.assets[0];
    if (a) onCapture({ uri: a.uri, kind: a.type === 'video' ? 'video' : 'image', width: a.width, height: a.height });
  }, [onCapture]);

  // gestures on the preview: tap = focus, double tap = flip, pinch = zoom
  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e, ok) => {
      if (!ok) return;
      focusX.value = e.x;
      focusY.value = e.y;
      focusS.value = 1.4;
      focusO.value = 1;
      focusS.value = withSpring(1, { damping: 12, stiffness: 200 });
      focusO.value = withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 300 }));
      runOnJS(refocus)();
      runOnJS(selectHaptic)();
    });
  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd((_e, ok) => {
    if (ok) runOnJS(flip)();
  });
  const pinch = Gesture.Pinch()
    .onBegin(() => {
      zoomStart.value = zoomSV.value;
    })
    .onUpdate((e) => {
      const z = Math.min(1, Math.max(0, zoomStart.value + (e.scale - 1) * 0.35));
      zoomSV.value = z;
      runOnJS(setZoom)(Math.round(z * 100) / 100);
    });
  const previewGesture = Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, tap));

  // shutter: tap = photo, long press = video
  // Browsers can't record from expo-camera: no hold-for-video on web.
  const longPress = Gesture.LongPress()
      .enabled(!IS_WEB)
      .minDuration(280)
      .maxDistance(400)
      .onStart(() => {
        shutterScale.value = withSpring(1.25, { damping: 12 });
        runOnJS(startVideo)();
      })
      .onFinalize(() => {
        shutterScale.value = withSpring(1);
        runOnJS(stopVideo)();
      });
  const shutterTap = Gesture.Tap().onEnd((_e, ok) => {
    if (!ok) return;
    shutterScale.value = withSequence(withTiming(0.86, { duration: 70 }), withSpring(1));
    runOnJS(takePhoto)();
  });
  if (blockGesture) {
    longPress.blocksExternalGesture(blockGesture);
    shutterTap.blocksExternalGesture(blockGesture);
  }
  const shutter = Gesture.Exclusive(longPress, shutterTap);

  const focusStyle = useAnimatedStyle(() => ({
    opacity: focusO.value,
    transform: [{ translateX: focusX.value - 36 }, { translateY: focusY.value - 36 }, { scale: focusS.value }],
  }));
  const shutterStyle = useAnimatedStyle(() => ({ transform: [{ scale: shutterScale.value }] }));
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING_C * (1 - ring.value) }));

  if (!camPerm) return <View style={styles.black} />;
  if (!camPerm.granted) {
    return (
      <View style={[styles.black, styles.center, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <Ionicons name="camera-outline" size={56} color={colors.textMuted} />
        <Txt variant="heading" center>{s.snaps.noPermission}</Txt>
        {camPerm.canAskAgain ? (
          <Button title={s.snaps.allow} onPress={requestCam} small />
        ) : (
          <Button title={s.snaps.openSettings} onPress={() => Linking.openSettings()} small variant="glass" />
        )}
        <Button title={s.snaps.gallery} onPress={pickFromGallery} small variant="ghost" />
      </View>
    );
  }

  const flashIcon = flash === 'on' ? 'flash' : flash === 'auto' ? 'flash-outline' : 'flash-off';
  const camFlash: FlashMode = flash === 'on' && facing === 'front' ? 'screen' : flash;

  return (
    <View style={styles.black}>
      <GestureDetector gesture={previewGesture}>
        <View style={StyleSheet.absoluteFill}>
          {error ? (
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              <Txt muted>{s.snaps.cameraUnavailable}</Txt>
            </View>
          ) : (
            <CameraView
              ref={cam}
              style={StyleSheet.absoluteFill}
              active={live}
              facing={facing}
              flash={camFlash}
              enableTorch={recording && flash === 'on' && facing === 'back'}
              mode={mode}
              zoom={zoom}
              autofocus={focus}
              mirror={facing === 'front'}
              animateShutter={!reduce}
              onCameraReady={() => {
                ready.current = true;
              }}
              onMountError={() => setError(true)}
            />
          )}
          <Animated.View pointerEvents="none" style={[styles.focusRing, focusStyle]} />
        </View>
      </GestureDetector>

      {/* side controls */}
      <View style={[styles.sideControls, { top: topInset + space.md }]}>
        <IconButton name="camera-reverse-outline" label={s.snaps.flip} onPress={flip} />
        <IconButton
          name={flashIcon}
          label={flash === 'on' ? s.snaps.flashOn : flash === 'auto' ? s.snaps.flashAuto : s.snaps.flashOff}
          onPress={() => setFlash((f) => (f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off'))}
          color={flash === 'off' ? colors.text : colors.warning}
        />
      </View>

      {recording && (
        <View style={[styles.recPill, { top: topInset + space.md }]}>
          <View style={styles.recDot} />
          <Txt variant="tiny">{s.snaps.recording}</Txt>
        </View>
      )}

      <View style={[styles.bottom, { bottom: bottomInset + space.md }]} pointerEvents="box-none">
        {accessory}
        <View style={styles.shutterRow}>
          <IconButton name="images-outline" label={s.snaps.gallery} onPress={pickFromGallery} />
          <GestureDetector gesture={shutter}>
            <Animated.View style={[styles.shutterWrap, shutterStyle]} accessible accessibilityRole="button" accessibilityLabel={s.snaps.shutter}>
              <Svg width={SHUTTER} height={SHUTTER} style={StyleSheet.absoluteFill}>
                <Circle cx={SHUTTER / 2} cy={SHUTTER / 2} r={RING_R} stroke="rgba(255,255,255,0.9)" strokeWidth={5} fill="none" />
                <AnimatedCircle
                  cx={SHUTTER / 2}
                  cy={SHUTTER / 2}
                  r={RING_R}
                  stroke={colors.accent}
                  strokeWidth={6}
                  fill="none"
                  strokeDasharray={`${RING_C} ${RING_C}`}
                  animatedProps={ringProps}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${SHUTTER / 2} ${SHUTTER / 2})`}
                />
              </Svg>
              <View style={[styles.shutterInner, recording && styles.shutterRec]} />
            </Animated.View>
          </GestureDetector>
          <View style={{ width: 42 }} />
        </View>
        {!IS_WEB && <Txt variant="tiny" muted center>{s.snaps.holdForVideo}</Txt>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  focusRing: { position: 'absolute', top: 0, left: 0, width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: colors.warning },
  sideControls: { position: 'absolute', end: space.lg, gap: space.md },
  recPill: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  bottom: { position: 'absolute', start: 0, end: 0, gap: space.sm, alignItems: 'center' },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '76%' },
  shutterWrap: { width: SHUTTER, height: SHUTTER, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.25)' },
  shutterRec: { backgroundColor: colors.accent, width: 34, height: 34, borderRadius: 10 },
});
