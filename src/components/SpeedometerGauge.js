import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop, G, Text as SvgText } from 'react-native-svg';

const SIZE = 260;
const C = SIZE / 2;
const R = 108; // arc radius
const STROKE = 14;
const START_DEG = 135; // arc starts bottom-left
const SWEEP_DEG = 270; // total sweep

function polarToXY(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const s = polarToXY(cx, cy, r, startDeg);
  const e = polarToXY(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export default function SpeedometerGauge({ speed = 0, maxSpeed = 160, unit = 'mph', label = '' }) {
  const clampedSpeed = Math.min(speed, maxSpeed);
  const fraction = clampedSpeed / maxSpeed;
  const arcEnd = START_DEG + SWEEP_DEG * fraction;

  // Tick marks every 20 mph
  const ticks = [];
  for (let s = 0; s <= maxSpeed; s += 20) {
    const deg = START_DEG + (s / maxSpeed) * SWEEP_DEG;
    const inner = polarToXY(C, C, R - 18, deg);
    const outer = polarToXY(C, C, R - 8, deg);
    const label = polarToXY(C, C, R - 32, deg);
    ticks.push({ inner, outer, label, value: s, deg });
  }

  const speedStr = speed.toFixed(speed >= 10 ? 1 : 1);

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <LinearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#ff6b35" />
            <Stop offset="50%" stopColor="#e51515" />
            <Stop offset="100%" stopColor="#ff1744" />
          </LinearGradient>
        </Defs>

        {/* Outer glow ring (fake — just a slightly larger arc) */}
        <Path
          d={arcPath(C, C, R, START_DEG, START_DEG + SWEEP_DEG)}
          fill="none" stroke="#1a1a1a" strokeWidth={STROKE + 6} strokeLinecap="round"
        />

        {/* Background arc track */}
        <Path
          d={arcPath(C, C, R, START_DEG, START_DEG + SWEEP_DEG)}
          fill="none" stroke="#1e1e1e" strokeWidth={STROKE} strokeLinecap="round"
        />

        {/* Speed arc */}
        {fraction > 0 && (
          <Path
            d={arcPath(C, C, R, START_DEG, arcEnd)}
            fill="none" stroke="url(#arcGrad)" strokeWidth={STROKE} strokeLinecap="round"
          />
        )}

        {/* Tick marks */}
        {ticks.map((t, i) => (
          <G key={i}>
            <Path d={`M ${t.inner.x} ${t.inner.y} L ${t.outer.x} ${t.outer.y}`}
              stroke={i === 0 ? '#333' : '#2a2a2a'} strokeWidth={i % 2 === 0 ? 2 : 1} />
            {t.value % 40 === 0 && (
              <SvgText x={t.label.x} y={t.label.y + 4} fontSize={10} fill="#333"
                textAnchor="middle">{t.value}</SvgText>
            )}
          </G>
        ))}

        {/* Center dot */}
        <Circle cx={C} cy={C} r={6} fill="#e51515" />
        <Circle cx={C} cy={C} r={3} fill="#fff" />
      </Svg>

      {/* Speed number overlaid */}
      <View style={styles.overlay} pointerEvents="none">
        <Text style={styles.speedNum}>{speedStr}</Text>
        <Text style={styles.unit}>{unit}</Text>
        {label ? <Text style={styles.label}>{label}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: SIZE, height: SIZE, alignSelf: 'center', position: 'relative' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  speedNum: { color: '#fff', fontSize: 72, fontWeight: '900', letterSpacing: -3, lineHeight: 76, includeFontPadding: false },
  unit: { color: '#e51515', fontSize: 16, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase', marginTop: -4 },
  label: { color: '#333', fontSize: 11, marginTop: 8, letterSpacing: 2 },
});
