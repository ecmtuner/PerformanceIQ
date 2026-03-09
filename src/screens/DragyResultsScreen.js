import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import SimpleLineChart from '../components/SimpleLineChart';

const SPLITS = [10, 20, 30, 40, 50, 60];

// SAE J1349 slope correction for 0-60 time
// formula: corrected = raw / (1 + slope% * 0.015)
const slopeCorrectTime = (rawTime, slopePct) => {
  if (!rawTime || rawTime === null) return null;
  const corrected = parseFloat(rawTime) / (1 + slopePct * 0.015);
  return corrected.toFixed(3);
};

export default function DragyResultsScreen({ route, navigation }) {
  const { samples, altSamples } = route.params;

  // Build time-series: normalize time to seconds from launch
  const launchTime = samples.length > 0 ? samples[0].time : 0;
  const chartData = useMemo(() => samples.map(s => ({
    t: parseFloat(((s.time - launchTime) / 1000).toFixed(2)),
    speed: parseFloat(s.speedMph.toFixed(1)),
    accel: 0, // filled below
  })), [samples]);

  // Calculate acceleration (g) = delta_v / (g * delta_t)
  for (let i = 1; i < chartData.length; i++) {
    const dv = (chartData[i].speed - chartData[i-1].speed) * 0.44704; // mph → m/s
    const dt = chartData[i].t - chartData[i-1].t;
    chartData[i].accel = dt > 0 ? parseFloat((dv / (9.81 * dt)).toFixed(2)) : 0;
  }

  // Altitude samples in feet
  const altData = useMemo(() => (altSamples || []).map(s => ({
    t: parseFloat(((s.time - launchTime) / 1000).toFixed(2)),
    alt: parseFloat((s.altM * 3.28084).toFixed(1)),
  })), [altSamples]);

  // Slope calculation: rise over run
  const slope = useMemo(() => {
    if (altSamples && altSamples.length >= 2) {
      const altChangeFt = (altSamples[altSamples.length-1].altM - altSamples[0].altM) * 3.28084;
      let distFt = 0;
      for (let i = 1; i < samples.length; i++) {
        const dt = (samples[i].time - samples[i-1].time) / 3600000;
        distFt += ((samples[i].speedMph + samples[i-1].speedMph) / 2) * dt * 5280;
      }
      return distFt > 10 ? parseFloat(((altChangeFt / distFt) * 100).toFixed(2)) : 0;
    }
    return 0;
  }, [samples, altSamples]);

  // Distance in feet
  const distanceFt = useMemo(() => {
    let dist = 0;
    for (let i = 1; i < samples.length; i++) {
      const dt = (samples[i].time - samples[i-1].time) / 3600000;
      dist += ((samples[i].speedMph + samples[i-1].speedMph) / 2) * dt * 5280;
    }
    return parseFloat(dist.toFixed(1));
  }, [samples]);

  // Split times
  const splitTimes = useMemo(() => {
    return SPLITS.map(target => {
      for (let i = 1; i < samples.length; i++) {
        if (samples[i].speedMph >= target) {
          const s0 = samples[i-1], s1 = samples[i];
          const frac = (target - s0.speedMph) / (s1.speedMph - s0.speedMph);
          const t = ((s0.time + frac * (s1.time - s0.time)) - launchTime) / 1000;
          return { label: `0–${target}`, raw: t.toFixed(3), corrected: slopeCorrectTime(t.toFixed(3), slope) };
        }
      }
      return { label: `0–${target}`, raw: null, corrected: null };
    });
  }, [samples, slope]);

  // 0-60 with 1ft rollout (start at 1 mph ≈ 1ft rollout)
  const rollout1ft = useMemo(() => {
    const startIdx = samples.findIndex(s => s.speedMph >= 1.0);
    if (startIdx < 0) return null;
    const startTime = samples[startIdx].time;
    for (let i = startIdx + 1; i < samples.length; i++) {
      if (samples[i].speedMph >= 60) {
        const s0 = samples[i-1], s1 = samples[i];
        const frac = (60 - s0.speedMph) / (s1.speedMph - s0.speedMph);
        const t = ((s0.time + frac * (s1.time - s0.time)) - startTime) / 1000;
        return t.toFixed(3);
      }
    }
    return null;
  }, [samples]);

  const alt0 = altSamples && altSamples[0] ? (altSamples[0].altM * 3.28084).toFixed(0) : '—';
  const sats = route.params.satellites || 12;
  const t060 = splitTimes.find(s => s.label === '0–60');

  const shareResults = async () => {
    const lines = [
      `PerformanceIQ — Performance Report`,
      `Distance: ${distanceFt}ft | Slope: ${slope}%`,
      ``,
      ...splitTimes.filter(s => s.raw).map(s =>
        `${s.label} mph: ${s.raw}s (slope-corrected: ${s.corrected}s)`
      ),
      rollout1ft ? `0–60 (1ft rollout): ${rollout1ft}s` : '',
    ].filter(Boolean).join('\n');
    await Share.share({ message: lines });
  };

  // Downsample chart to max 100 points for perf
  const downsample = (arr, max) => {
    if (arr.length <= max) return arr;
    const step = Math.ceil(arr.length / max);
    return arr.filter((_, i) => i % step === 0);
  };
  const chartPoints = downsample(chartData, 100);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Performance Report</Text>
        <TouchableOpacity onPress={shareResults} style={styles.shareBtn}>
          <Text style={styles.shareText}>📤</Text>
        </TouchableOpacity>
      </View>

      {/* Environmental bar */}
      <View style={styles.envBar}>
        <Text style={styles.envItem}>⬆ {alt0}ft</Text>
        <Text style={styles.envItem}>🛰 {sats} sats</Text>
        <Text style={styles.envItem}>📐 {slope}% slope</Text>
      </View>

      {/* Chart */}
      {chartPoints.length > 2 && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Speed & Acceleration vs Time</Text>
          <SimpleLineChart
            data={chartPoints}
            width={340}
            height={180}
            lines={[
              { xKey: 't', yKey: 'speed', color: '#4fc3f7', label: 'Speed (mph)' },
              { xKey: 't', yKey: 'accel', color: '#ffb74d', label: 'Accel (g)' },
            ]}
          />
        </View>
      )}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statIcon}>📏</Text>
          <Text style={styles.statValue}>{distanceFt}ft</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statIcon}>⏱</Text>
          <Text style={styles.statValue}>{t060?.raw || '—'}s</Text>
          <Text style={styles.statLabel}>0–60 mph</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statIcon}>📐</Text>
          <Text style={styles.statValue}>{slope}%</Text>
          <Text style={styles.statLabel}>Slope</Text>
        </View>
      </View>

      {/* Split table */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Split Times</Text>
        <View style={styles.splitHeader}>
          <Text style={[styles.splitCol, styles.splitLabel, {color:'#888'}]}>Split</Text>
          <Text style={[styles.splitCol, styles.splitTime, {color:'#888'}]}>Raw</Text>
          <Text style={[styles.splitCol, styles.splitTime, {color:'#e51515'}]}>Slope Corrected</Text>
        </View>
        {splitTimes.map(s => (
          <View key={s.label} style={styles.splitRow}>
            <Text style={[styles.splitCol, styles.splitLabel]}>● {s.label} mph</Text>
            <Text style={[styles.splitCol, styles.splitTime]}>{s.raw ? `${s.raw}s` : '—'}</Text>
            <Text style={[styles.splitCol, styles.splitTime, {color: s.corrected ? '#e51515' : '#555'}]}>
              {s.corrected ? `${s.corrected}s` : '—'}
            </Text>
          </View>
        ))}
        {rollout1ft && (
          <View style={styles.splitRow}>
            <Text style={[styles.splitCol, styles.splitLabel]}>● 0–60 (1ft rollout)</Text>
            <Text style={[styles.splitCol, styles.splitTime]}>{rollout1ft}s</Text>
            <Text style={[styles.splitCol, styles.splitTime, {color:'#e51515'}]}>
              {slopeCorrectTime(rollout1ft, slope)}s
            </Text>
          </View>
        )}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 20 },
  back: { paddingRight: 12 },
  backText: { color: '#e51515', fontSize: 20, fontWeight: '700' },
  title: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  shareBtn: { paddingLeft: 12 },
  shareText: { fontSize: 20 },
  envBar: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#1a1a1a', padding: 10, marginHorizontal: 16, borderRadius: 10, marginBottom: 12 },
  envItem: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  chartCard: { backgroundColor: '#111', borderRadius: 12, margin: 16, marginBottom: 0, padding: 12 },
  chartTitle: { color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },

  statsRow: { flexDirection: 'row', margin: 16, gap: 10 },
  statBox: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, alignItems: 'center' },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statLabel: { color: '#666', fontSize: 10, textTransform: 'uppercase', marginTop: 2 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, margin: 16, padding: 14 },
  sectionTitle: { color: '#aaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  splitHeader: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#222', marginBottom: 4 },
  splitRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#111' },
  splitCol: { flex: 1 },
  splitLabel: { color: '#ccc', fontSize: 14 },
  splitTime: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'right' },
});
