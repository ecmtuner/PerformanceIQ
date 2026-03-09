import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Text as SvgText, Rect } from 'react-native-svg';

export default function SimpleLineChart({ data, width = 320, height = 160, lines = [] }) {
  if (!data || data.length < 2) return null;

  const padL = 36, padR = 12, padT = 10, padB = 28;
  const W = width - padL - padR;
  const H = height - padT - padB;

  const xKey = lines[0]?.xKey || 't';
  const xs = data.map(d => d[xKey]);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);

  const toX = v => padL + ((v - xMin) / (xMax - xMin || 1)) * W;

  return (
    <View>
      <Svg width={width} height={height}>
        {/* Background */}
        <Rect x={padL} y={padT} width={W} height={H} fill="#111" rx={4} />

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <Line key={f}
            x1={padL} x2={padL + W}
            y1={padT + H * (1 - f)} y2={padT + H * (1 - f)}
            stroke="#222" strokeWidth={1}
          />
        ))}

        {/* X axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const val = xMin + f * (xMax - xMin);
          return (
            <SvgText key={f} x={padL + f * W} y={height - 6}
              fontSize={9} fill="#555" textAnchor="middle">
              {val.toFixed(1)}s
            </SvgText>
          );
        })}

        {/* Data lines */}
        {lines.map(({ yKey, color, label }) => {
          const ys = data.map(d => d[yKey]);
          const yMin = Math.min(...ys), yMax = Math.max(...ys);
          const range = yMax - yMin || 1;
          const toY = v => padT + H - ((v - yMin) / range) * H;

          const points = data
            .map(d => `${toX(d[xKey]).toFixed(1)},${toY(d[yKey]).toFixed(1)}`)
            .join(' ');

          return (
            <Polyline key={yKey} points={points}
              fill="none" stroke={color} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round"
            />
          );
        })}

        {/* Y axis labels for first line */}
        {lines[0] && (() => {
          const ys = data.map(d => d[lines[0].yKey]);
          const yMin = Math.min(...ys), yMax = Math.max(...ys);
          return [0, 0.5, 1].map(f => {
            const val = yMin + f * (yMax - yMin);
            return (
              <SvgText key={f} x={padL - 3} y={padT + H * (1 - f) + 4}
                fontSize={9} fill={lines[0].color} textAnchor="end">
                {val.toFixed(0)}
              </SvgText>
            );
          });
        })()}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        {lines.map(l => (
          <View key={l.yKey} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: l.color }]} />
            <Text style={[styles.legendText, { color: l.color }]}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600' },
});
