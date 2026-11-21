/** Body map (نەخشەی لەش): private taps; only overlaps are shown to both. */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Glass } from '@/components/Glass';
import { Txt } from '@/components/Txt';
import { Pressy } from '@/components/Pressy';
import { ErrorState, Skeleton } from '@/components/States';
import { colors, radius, space } from '@/lib/theme';
import { useStrings } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { haptic } from '@/lib/haptics';
import { SpicyScreen } from '@/features/spicy/SpicyScreen';
import { BodyFigure, INTENSITY_FILL } from '@/features/spicy/BodyFigure';
import { useSpicyUnlocked } from '@/features/spicy/gate';
import { useAsync } from '@/features/spicy/useAsync';
import { EXTRA_REGIONS, nextIntensity, type Intensity, type RegionId } from '@/features/spicy/bodyRegions';
import { loadBodyMap, loadBodyMatches, setBodyArea, type BodyAnswers, type BodyMatch, type Side } from '@/features/spicy/api';

export default function BodyMap() {
  const s = useStrings();
  const { userId, couple, spicyActive } = useSession();
  const unlocked = useSpicyUnlocked();
  const enabled = spicyActive && unlocked && !!userId;
  const mine = useAsync(() => loadBodyMap(userId as string), [userId], enabled);
  const [matches, setMatches] = useState<BodyMatch[] | null>(null);
  const [side, setSide] = useState<Side>('mine');
  const [last, setLast] = useState<RegionId | null>(null);

  const refreshMatches = useCallback(() => {
    if (enabled) loadBodyMatches().then(setMatches).catch(() => setMatches([]));
  }, [enabled]);
  useFocusEffect(refreshMatches);

  const tap = async (r: RegionId) => {
    if (!couple || !mine.data) return;
    const prev = mine.data;
    const v = nextIntensity((prev[side][r] ?? 0) as Intensity);
    const next: BodyAnswers = { ...prev, [side]: { ...prev[side], [r]: v } };
    if (v === 0) delete next[side][r];
    mine.setData(next);
    setLast(r);
    if (v === 3) haptic.heavy();
    else if (v === 0) haptic.soft();
    else haptic.tap();
    try {
      await setBodyArea(couple.id, side, r, v);
      refreshMatches();
    } catch {
      haptic.error();
      mine.setData(prev);
    }
  };

  const region = (id: string) => (s.spicy.body.regions as Record<string, string>)[id] ?? id;
  const highlight = useMemo(() => new Set((matches ?? []).map((m) => m.area)), [matches]);

  return (
    <SpicyScreen title={s.spicy.body.title}>
      <Txt muted>{s.spicy.body.intro}</Txt>
      <View style={styles.segment}>
        {(['mine', 'yours'] as Side[]).map((sd) => (
          <Pressy key={sd} hapticStyle="select" onPress={() => setSide(sd)} style={[styles.seg, side === sd && styles.segOn]}>
            <Txt variant="heading" color={side === sd ? colors.text : colors.textMuted}>{sd === 'mine' ? s.spicy.body.onMe : s.spicy.body.onYou}</Txt>
          </Pressy>
        ))}
      </View>
      <Txt variant="small" muted center>{side === 'mine' ? s.spicy.body.onMeHint : s.spicy.body.onYouHint}</Txt>

      {mine.error ? <ErrorState onRetry={mine.reload} /> : !mine.data ? (
        <Skeleton height={400} />
      ) : (
        <Glass style={styles.center}>
          <BodyFigure values={mine.data[side]} onTap={tap} />
          <View style={styles.legend}>
            {([1, 2, 3] as const).map((i) => (
              <View key={i} style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: INTENSITY_FILL[i] }]} />
                <Txt variant="tiny" muted>{s.spicy.body.intensity[i]}</Txt>
              </View>
            ))}
          </View>
          {last ? <Txt variant="small" color={colors.rose}>{`${region(last)} · ${mine.data[side][last] ? s.spicy.body.intensity[mine.data[side][last] as 1 | 2 | 3] : '—'}`}</Txt> : null}
          <Txt variant="small" muted>{s.spicy.body.other}</Txt>
          <View style={styles.chips}>
            {EXTRA_REGIONS.map((r) => {
              const v = (mine.data?.[side][r] ?? 0) as Intensity;
              return (
                <Pressy key={r} hapticStyle="none" onPress={() => tap(r)} style={[styles.chip, { backgroundColor: INTENSITY_FILL[v] }]}>
                  <Txt variant="small">{`${region(r)}${v ? ` · ${v}` : ''}`}</Txt>
                </Pressy>
              );
            })}
          </View>
        </Glass>
      )}

      <Glass style={styles.gap}>
        <Txt variant="heading">{`💞 ${s.spicy.body.matchesTitle}`}</Txt>
        {matches === null ? <Skeleton height={40} /> : matches.length === 0 ? (
          <Txt muted variant="small">{s.spicy.body.matchesEmpty}</Txt>
        ) : (
          <>
            <BodyFigure values={Object.fromEntries(matches.map((m) => [m.area, m.intensity as Intensity]))} highlight={highlight} height={220} />
            {matches.map((m) => (
              <View key={`${m.area}-${m.kind}`} style={styles.matchRow}>
                <View style={[styles.swatch, { backgroundColor: INTENSITY_FILL[m.intensity as Intensity] }]} />
                <Txt style={styles.flex}>{region(m.area)}</Txt>
                <Txt variant="small" muted>{m.kind === 'on_me' ? s.spicy.body.matchOnMe : s.spicy.body.matchOnYou}</Txt>
              </View>
            ))}
          </>
        )}
      </Glass>
      <Txt variant="small" muted center>{s.spicy.privateNote}</Txt>
    </SpicyScreen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  center: { alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, gap: 4 },
  seg: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.pill },
  segOn: { backgroundColor: colors.accent },
  legend: { flexDirection: 'row', gap: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' },
  chip: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'stretch' },
});
