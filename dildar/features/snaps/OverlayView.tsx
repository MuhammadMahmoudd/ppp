/** Renders a snap overlay (filter tint, doodles, text) over media. */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Txt } from '@/components/Txt';
import { fonts } from '@/lib/theme';
import { FILTER_LAYERS } from './filters';
import { strokePath, type SnapOverlay, type Stroke } from './overlay';

export function FilterLayer({ filter }: { filter: SnapOverlay['filter'] }) {
  return (
    <>
      {FILTER_LAYERS[filter].map((st, i) => (
        <View key={i} pointerEvents="none" style={[StyleSheet.absoluteFill, st]} />
      ))}
    </>
  );
}

export function Strokes({ strokes, width, height, live }: { strokes: Stroke[]; width: number; height: number; live?: Stroke | null }) {
  if (!width || !height) return null;
  const all = live ? [...strokes, live] : strokes;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {all.map((s, i) => (
        <Path key={i} d={strokePath(s.points, width, height)} stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </Svg>
  );
}

export function TextBubble({ text, color, size, bg }: { text: string; color: string; size: number; bg: boolean }) {
  return (
    <View style={[styles.bubble, bg && styles.bubbleBg]}>
      <Txt style={{ color, fontSize: size, lineHeight: size * 1.45, fontFamily: fonts.bold, textAlign: 'center', writingDirection: 'auto' }}>{text}</Txt>
    </View>
  );
}

/** Full-width row centered on (x,y): horizontal offset via translateX. */
export function textPosition(x: number, y: number, size: number, width: number, height: number) {
  return { width, top: y * height - size * 0.75, transform: [{ translateX: (x - 0.5) * width }] };
}

/** Static (read-only) overlay for the viewer. */
export function OverlayView({ overlay, width, height }: { overlay: SnapOverlay; width: number; height: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.ltr]} pointerEvents="none">
      <FilterLayer filter={overlay.filter} />
      <Strokes strokes={overlay.strokes} width={width} height={height} />
      {overlay.texts.map((t) => (
        <View key={t.id} style={[styles.textRow, textPosition(t.x, t.y, t.size, width, height)]}>
          <TextBubble text={t.text} color={t.color} size={t.size} bg={t.bg} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ltr: { direction: 'ltr' },
  textRow: { position: 'absolute', left: 0, alignItems: 'center' },
  bubble: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 14, maxWidth: '86%' },
  bubbleBg: { backgroundColor: 'rgba(0,0,0,0.55)' },
});
