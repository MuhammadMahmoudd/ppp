/**
 * Neutral decoy screen for quick-hide: a real, working calculator.
 * Typing 2580= (or holding "=") asks for Face ID and returns to Dildar.
 * Deliberately English/Latin digits and no hearts — it should look boring.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { unlock } from './lockStore';

const SECRET = '2580';
const KEYS = [
  ['C', '±', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '='],
];

function evaluate(expr: string): string {
  const tokens = expr.match(/(\d+\.?\d*|[+\-×÷])/g);
  if (!tokens) return '0';
  const nums: number[] = [];
  const ops: string[] = [];
  const prec = (o: string) => (o === '×' || o === '÷' ? 2 : 1);
  const apply = () => {
    const b = nums.pop() ?? 0;
    const a = nums.pop() ?? 0;
    const o = ops.pop();
    nums.push(o === '+' ? a + b : o === '-' ? a - b : o === '×' ? a * b : b === 0 ? NaN : a / b);
  };
  for (const t of tokens) {
    if (/\d/.test(t)) nums.push(parseFloat(t));
    else {
      while (ops.length && prec(ops[ops.length - 1]) >= prec(t)) apply();
      ops.push(t);
    }
  }
  while (ops.length) apply();
  const r = nums[0];
  if (!isFinite(r)) return 'Error';
  return String(Math.round(r * 1e10) / 1e10);
}

export function FakeCalculator() {
  const [display, setDisplay] = useState('0');
  const [typed, setTyped] = useState('');

  const press = (k: string) => {
    if (k === '=') {
      if (typed === SECRET) {
        setTyped('');
        unlock();
        return;
      }
      setDisplay(evaluate(display.replace(/−/g, '-')));
      setTyped('');
      return;
    }
    if (k === 'C') {
      setDisplay('0');
      setTyped('');
      return;
    }
    if (k === '±') return setDisplay((d) => (d.startsWith('-') ? d.slice(1) : d === '0' ? d : `-${d}`));
    if (k === '%') return setDisplay((d) => String(parseFloat(d) / 100 || 0));
    setTyped((t) => (/\d/.test(k) ? (t + k).slice(-8) : ''));
    setDisplay((d) => (d === '0' && /\d/.test(k) ? k : d + (k === '−' ? '-' : k)));
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <View style={styles.displayWrap}>
          <Text style={styles.display} numberOfLines={1} adjustsFontSizeToFit>{display}</Text>
        </View>
        <View style={styles.pad}>
          {KEYS.map((row, i) => (
            <View key={i} style={styles.row}>
              {row.map((k) => (
                <Pressable
                  key={k}
                  onPress={() => press(k)}
                  onLongPress={k === '=' ? () => unlock() : undefined}
                  delayLongPress={900}
                  style={({ pressed }) => [styles.key, k === '0' && styles.zero, /[÷×−+=]/.test(k) && styles.op, /[C±%]/.test(k) && styles.fn, pressed && styles.pressed]}
                >
                  <Text style={[styles.keyText, /[C±%]/.test(k) && styles.fnText]}>{k}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#000', zIndex: 2000, direction: 'ltr' },
  flex: { flex: 1, justifyContent: 'flex-end' },
  displayWrap: { paddingHorizontal: 24, paddingBottom: 12 },
  display: { color: '#fff', fontSize: 84, fontWeight: '300', textAlign: 'right' },
  pad: { paddingHorizontal: 12, paddingBottom: 12, gap: 12 },
  row: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  key: { flex: 1, aspectRatio: 1, borderRadius: 999, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  zero: { flex: 2.15, aspectRatio: undefined, alignItems: 'flex-start', paddingLeft: 32 },
  op: { backgroundColor: '#FF9F0A' },
  fn: { backgroundColor: '#A5A5A5' },
  pressed: { opacity: 0.6 },
  keyText: { color: '#fff', fontSize: 34 },
  fnText: { color: '#000' },
});
