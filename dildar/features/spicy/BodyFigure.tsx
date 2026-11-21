/** Abstract, non-explicit silhouette with tappable regions. */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Rect } from 'react-native-svg';
import { FIGURE_REGIONS, REGION_SHAPES, type Intensity, type RegionId, type Shape } from './bodyRegions';

export const INTENSITY_FILL: Record<Intensity, string> = {
  0: 'rgba(255,255,255,0.07)',
  1: 'rgba(255,143,163,0.40)',
  2: 'rgba(255,77,109,0.70)',
  3: 'rgba(201,24,74,0.98)',
};
const STROKE = 'rgba(255,255,255,0.18)';

function ShapeEl({ s, fill, onPress }: { s: Shape; fill: string; onPress?: () => void }) {
  const common = { fill, stroke: STROKE, strokeWidth: 1, onPress };
  if (s.kind === 'circle') return <Circle cx={s.cx} cy={s.cy} r={s.r} {...common} />;
  if (s.kind === 'ellipse') return <Ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common} />;
  return <Rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} ry={s.r} {...common} />;
}

export function BodyFigure({ values, onTap, height = 400, highlight }: {
  values: Partial<Record<RegionId, Intensity>>;
  onTap?: (r: RegionId) => void;
  height?: number;
  /** matches mode: regions to glow (others dimmed) */
  highlight?: Set<string>;
}) {
  const width = (height * 200) / 420;
  return (
    <View style={styles.wrap} accessible={false}>
      <Svg width={width} height={height} viewBox="0 0 200 420">
        {FIGURE_REGIONS.map((r) => {
          const v: Intensity = values[r] ?? 0;
          const fill = highlight ? (highlight.has(r) ? INTENSITY_FILL[Math.max(1, v) as Intensity] : 'rgba(255,255,255,0.04)') : INTENSITY_FILL[v];
          return (
            <G key={r}>
              {REGION_SHAPES[r].map((sh, i) => <ShapeEl key={i} s={sh} fill={fill} onPress={onTap ? () => onTap(r) : undefined} />)}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: 'center', direction: 'ltr' } });
