import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Text as SvgText, G } from 'react-native-svg';

const W = Dimensions.get('window').width - 32;
const PAD = { top: 12, right: 16, bottom: 32, left: 42 };
const CHART_W = W - PAD.left - PAD.right;

// Build a smooth bezier path from points array [{x,y}]
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function closedPath(pts, chartH) {
  if (pts.length < 2) return '';
  const open = smoothPath(pts);
  return `${open} L ${pts[pts.length-1].x} ${chartH} L ${pts[0].x} ${chartH} Z`;
}

export default function RunChart({ samples, height = 220, bracket }) {
  if (!samples || samples.length < 2) return null;

  const chartH = height - PAD.top - PAD.bottom;

  // Time axis — full run duration
  const t0 = samples[0].time;
  const tMax = (samples[samples.length - 1].time - t0) / 1000;

  // Speed axis
  const allSpeeds = samples.map(s => s.speedMph || 0);
  const maxSpeed = Math.ceil(Math.max(...allSpeeds, 10) / 10) * 10; // round up to nearest 10

  // Accel per sample (capped at 1.5g for display)
  const accels = samples.map((s, i) => {
    if (i === 0) return 0;
    const dv = (s.speedMph - samples[i-1].speedMph) * 0.44704;
    const dt = (s.time - samples[i-1].time) / 1000;
    return dt > 0 ? Math.min(Math.max(dv / (9.81 * dt), -1.5), 1.5) : 0;
  });
  const maxAccel = Math.max(...accels.map(Math.abs), 0.1);

  // Downsample to 80 pts max for perf
  const step = Math.max(1, Math.floor(samples.length / 80));
  const pts = [];
  for (let i = 0; i < samples.length; i += step) {
    const t = (samples[i].time - t0) / 1000;
    const s = samples[i].speedMph || 0;
    const a = accels[i] || 0;
    pts.push({
      x: PAD.left + (t / tMax) * CHART_W,
      speedY: PAD.top + chartH - (s / maxSpeed) * chartH,
      accelY: PAD.top + chartH - ((a + maxAccel) / (2 * maxAccel)) * chartH,
      t, s, a,
    });
  }

  const speedPts = pts.map(p => ({ x: p.x, y: p.speedY }));
  const accelPts = pts.map(p => ({ x: p.x, y: p.accelY }));

  // Y-axis speed labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: PAD.top + chartH * (1 - f),
    label: Math.round(f * maxSpeed),
  }));

  // X-axis time labels (5 evenly spaced)
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    x: PAD.left + f * CHART_W,
    label: (f * tMax).toFixed(1) + 's',
  }));

  return (
    <View>
      <Svg width={W} height={height}>
        <Defs>
          <LinearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#4fc3f7" stopOpacity="0.5" />
            <Stop offset="100%" stopColor="#4fc3f7" stopOpacity="0.02" />
          </LinearGradient>
          <LinearGradient id="accelGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#ff8a65" stopOpacity="0.35" />
            <Stop offset="100%" stopColor="#ff8a65" stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* Grid */}
        {yTicks.map((t, i) => (
          <G key={i}>
            <Line x1={PAD.left} y1={t.y} x2={PAD.left + CHART_W} y2={t.y} stroke="#1e1e1e" strokeWidth={1} />
            <SvgText x={PAD.left - 4} y={t.y + 4} fontSize={9} fill="#444" textAnchor="end">{t.label}</SvgText>
          </G>
        ))}

        {/* Accel filled area */}
        <Path d={closedPath(accelPts, PAD.top + chartH)} fill="url(#accelGrad)" />
        {/* Accel line */}
        <Path d={smoothPath(accelPts)} fill="none" stroke="#ff8a65" strokeWidth={1.5} strokeOpacity={0.8} />

        {/* Speed filled area */}
        <Path d={closedPath(speedPts, PAD.top + chartH)} fill="url(#speedGrad)" />
        {/* Speed line */}
        <Path d={smoothPath(speedPts)} fill="none" stroke="#4fc3f7" strokeWidth={2.5} />

        {/* X-axis labels */}
        {xTicks.map((t, i) => (
          <SvgText key={i} x={t.x} y={height - 6} fontSize={9} fill="#444" textAnchor="middle">{t.label}</SvgText>
        ))}

        {/* Bracket highlight markers */}
        {bracket && (() => {
          const markers = [];
          [bracket.from, bracket.to].forEach((speed, idx) => {
            if (speed <= 0) return;
            // Find time when this speed was reached
            for (let i = 1; i < samples.length; i++) {
              if (samples[i].speedMph >= speed) {
                const s0 = samples[i-1], s1 = samples[i];
                const frac = (speed - s0.speedMph) / ((s1.speedMph - s0.speedMph) || 1);
                const t = ((s0.time + frac * (s1.time - s0.time)) - samples[0].time) / 1000;
                const x = PAD.left + (t / tMax) * CHART_W;
                markers.push(
                  <G key={idx}>
                    <Line x1={x} y1={PAD.top} x2={x} y2={PAD.top + chartH} stroke="#e51515" strokeWidth={1.5} strokeDasharray="4,3" />
                    <SvgText x={x + 3} y={PAD.top + 10} fontSize={9} fill="#e51515">{speed}mph</SvgText>
                  </G>
                );
                break;
              }
            }
          });
          return markers;
        })()}

        {/* Y-axis unit */}
        <SvgText x={PAD.left - 2} y={PAD.top - 2} fontSize={9} fill="#4fc3f7" textAnchor="end">mph</SvgText>
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#4fc3f7' }]} /><Text style={[styles.legendTxt, { color: '#4fc3f7' }]}>Speed (mph)</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#ff8a65' }]} /><Text style={[styles.legendTxt, { color: '#ff8a65' }]}>Acceleration (g)</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: 11, fontWeight: '600' },
});
