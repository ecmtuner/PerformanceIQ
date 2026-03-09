import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Dimensions } from 'react-native';
import { getLastRun } from '../services/RunStore';

const SPLITS = [10, 20, 30, 40, 50, 60];
const SCREEN_W = Dimensions.get('window').width;

const slopeCorrectTime = (rawTime, slopePct) => {
  if (rawTime === null || rawTime === undefined) return null;
  const corrected = parseFloat(rawTime) / (1 + slopePct * 0.015);
  return corrected.toFixed(3);
};

function SpeedChart({ data, height = 140 }) {
  if (!data || data.length < 2) return null;
  const speeds = data.map(d => d.speed);
  const maxSpeed = Math.max(...speeds, 1);
  const W = SCREEN_W - 64;
  const barW = Math.max(1, W / data.length);
  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#0d0d0d', borderRadius: 8, overflow: 'hidden', paddingHorizontal: 4 }}>
        {data.map((d, i) => (
          <View key={i} style={{ width: barW, height: Math.max(1, (d.speed / maxSpeed) * height), backgroundColor: '#4fc3f7', opacity: 0.4 + 0.6 * (d.speed / maxSpeed), marginRight: 0.5 }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        {[0, 0.5, 1].map(f => {
          const idx = Math.floor(f * (data.length - 1));
          return <Text key={f} style={{ color: '#444', fontSize: 9 }}>{(data[idx]?.t || 0).toFixed(1)}s</Text>;
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{ color: '#444', fontSize: 9 }}>0 mph</Text>
        <Text style={{ color: '#4fc3f7', fontSize: 9 }}>Peak: {maxSpeed.toFixed(1)} mph</Text>
      </View>
    </View>
  );
}

function AccelChart({ data, height = 70 }) {
  if (!data || data.length < 2) return null;
  const accels = data.map(d => Math.abs(d.accel));
  const maxA = Math.max(...accels, 0.1);
  const W = SCREEN_W - 64;
  const barW = Math.max(1, W / data.length);
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#0d0d0d', borderRadius: 8, overflow: 'hidden', paddingHorizontal: 4 }}>
      {data.map((d, i) => (
        <View key={i} style={{ width: barW, height: Math.max(1, (Math.abs(d.accel) / maxA) * height), backgroundColor: '#ffb74d', opacity: 0.3 + 0.7 * (Math.abs(d.accel) / maxA), marginRight: 0.5 }} />
      ))}
    </View>
  );
}

export default function DragyResultsScreen({ navigation }) {
  const run = getLastRun();
  if (!run || !run.samples || run.samples.length < 2) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#fff', fontSize: 16 }}>No run data.</Text>
        <Text style={{ color: '#666', marginTop: 8 }}>Start a run, then tap Stop Run.</Text>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={{ marginTop: 24 }}>
          <Text style={{ color: '#e51515', fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { samples, altSamples, satellites } = run;
  const launchTime = samples[0].time;

  const step = Math.max(1, Math.floor(samples.length / 120));
  const chartData = useMemo(() => {
    const result = [];
    for (let i = 0; i < samples.length; i += step) {
      const s = samples[i];
      const t = (s.time - launchTime) / 1000;
      let accel = 0;
      if (i > 0) {
        const prev = samples[Math.max(0, i - step)];
        const dv = (s.speedMph - prev.speedMph) * 0.44704;
        const dt = (s.time - prev.time) / 1000;
        accel = dt > 0 ? Math.abs(dv / (9.81 * dt)) : 0;
      }
      result.push({ t: parseFloat(t.toFixed(2)), speed: parseFloat(s.speedMph.toFixed(1)), accel: parseFloat(Math.min(accel, 3).toFixed(2)) });
    }
    return result;
  }, []);

  const slope = useMemo(() => {
    if (!altSamples || altSamples.length < 2) return 0;
    const altChangeFt = (altSamples[altSamples.length - 1].altM - altSamples[0].altM) * 3.28084;
    let distFt = 0;
    for (let i = 1; i < samples.length; i++) {
      const dt = (samples[i].time - samples[i-1].time) / 3600000;
      distFt += ((samples[i].speedMph + samples[i-1].speedMph) / 2) * dt * 5280;
    }
    return distFt > 10 ? parseFloat(((altChangeFt / distFt) * 100).toFixed(2)) : 0;
  }, []);

  const distanceFt = useMemo(() => {
    let dist = 0;
    for (let i = 1; i < samples.length; i++) {
      const dt = (samples[i].time - samples[i-1].time) / 3600000;
      dist += ((samples[i].speedMph + samples[i-1].speedMph) / 2) * dt * 5280;
    }
    return parseFloat(dist.toFixed(1));
  }, []);

  const splitTimes = useMemo(() => SPLITS.map(target => {
    for (let i = 1; i < samples.length; i++) {
      if (samples[i].speedMph >= target) {
        const s0 = samples[i-1], s1 = samples[i];
        const frac = (target - s0.speedMph) / (s1.speedMph - s0.speedMph);
        const t = ((s0.time + frac * (s1.time - s0.time)) - launchTime) / 1000;
        return { label: `0-${target}`, raw: t.toFixed(3), corrected: slopeCorrectTime(t.toFixed(3), slope) };
      }
    }
    return { label: `0-${target}`, raw: null, corrected: null };
  }), []);

  const rollout1ft = useMemo(() => {
    const si = samples.findIndex(s => s.speedMph >= 1.0);
    if (si < 0) return null;
    const startT = samples[si].time;
    for (let i = si+1; i < samples.length; i++) {
      if (samples[i].speedMph >= 60) {
        const s0 = samples[i-1], s1 = samples[i];
        const frac = (60 - s0.speedMph) / (s1.speedMph - s0.speedMph);
        return (((s0.time + frac*(s1.time-s0.time)) - startT) / 1000).toFixed(3);
      }
    }
    return null;
  }, []);

  const peakSpeed = Math.max(...samples.map(s => s.speedMph)).toFixed(1);
  const altFt = altSamples && altSamples.length > 0 ? (altSamples[0].altM * 3.28084).toFixed(0) : '—';
  const t060 = splitTimes.find(s => s.label === '0-60');

  const shareResults = async () => {
    const lines = [
      '⚡ PerformanceIQ — Performance Report',
      `Peak: ${peakSpeed} mph  Distance: ${distanceFt}ft  Slope: ${slope}%`,
      '',
      ...splitTimes.filter(s => s.raw).map(s => `${s.label} mph: ${s.raw}s (corrected: ${s.corrected}s)`),
      rollout1ft ? `0-60 (1ft rollout): ${rollout1ft}s (corrected: ${slopeCorrectTime(rollout1ft, slope)}s)` : '',
    ].filter(Boolean).join('\n');
    Share.share({ message: lines });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()}><Text style={styles.backText}>‹</Text></TouchableOpacity>
        <Text style={styles.title}>Performance Report</Text>
        <TouchableOpacity onPress={shareResults}><Text style={{ fontSize: 22 }}>📤</Text></TouchableOpacity>
      </View>

      <View style={styles.envBar}>
        <Text style={styles.envItem}>⬆ {altFt}ft</Text>
        <Text style={styles.envItem}>🛰 {satellites || 12} sats</Text>
        <Text style={styles.envItem}>📐 {slope}% slope</Text>
        <Text style={styles.envItem}>🏁 {peakSpeed} mph peak</Text>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartLabel}>⚡ SPEED (mph)</Text>
        <SpeedChart data={chartData} height={140} />
        <Text style={[styles.chartLabel, { marginTop: 14 }]}>🔥 ACCELERATION (g)</Text>
        <AccelChart data={chartData} height={70} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{distanceFt}ft</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, {color:'#e51515'}]}>{t060?.raw || '—'}s</Text>
          <Text style={styles.statLabel}>0-60 mph</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{slope}%</Text>
          <Text style={styles.statLabel}>Slope</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Split Times</Text>
        <View style={styles.row}>
          <Text style={[styles.c1,{color:'#555'}]}>Split</Text>
          <Text style={[styles.c2,{color:'#555'}]}>Raw</Text>
          <Text style={[styles.c3,{color:'#e51515'}]}>Slope Corrected</Text>
        </View>
        {splitTimes.map(s => (
          <View key={s.label} style={[styles.row, {borderTopWidth:1, borderTopColor:'#111', paddingTop:8}]}>
            <Text style={styles.c1}>{s.label} mph</Text>
            <Text style={styles.c2}>{s.raw ? `${s.raw}s` : '—'}</Text>
            <Text style={[styles.c3, {color: s.corrected ? '#e51515' : '#444'}]}>{s.corrected ? `${s.corrected}s` : '—'}</Text>
          </View>
        ))}
        {rollout1ft && (
          <View style={[styles.row, {borderTopWidth:1, borderTopColor:'#111', paddingTop:8}]}>
            <Text style={styles.c1}>0-60 (1ft)</Text>
            <Text style={styles.c2}>{rollout1ft}s</Text>
            <Text style={[styles.c3,{color:'#e51515'}]}>{slopeCorrectTime(rollout1ft, slope)}s</Text>
          </View>
        )}
      </View>
      <View style={{height:50}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0a0a0a' },
  header: { flexDirection:'row', alignItems:'center', padding:16, paddingTop:20 },
  backText: { color:'#e51515', fontSize:28, fontWeight:'700', marginRight:12 },
  title: { flex:1, color:'#fff', fontSize:17, fontWeight:'800', textAlign:'center' },
  envBar: { flexDirection:'row', flexWrap:'wrap', justifyContent:'space-around', backgroundColor:'#111', padding:10, marginHorizontal:16, borderRadius:10, marginBottom:12 },
  envItem: { color:'#ccc', fontSize:12, fontWeight:'600', padding:3 },
  chartCard: { backgroundColor:'#1a1a1a', borderRadius:12, margin:16, marginBottom:0, padding:14 },
  chartLabel: { color:'#666', fontSize:10, fontWeight:'700', textTransform:'uppercase', letterSpacing:1, marginBottom:6 },
  statsRow: { flexDirection:'row', margin:16, gap:10 },
  statBox: { flex:1, backgroundColor:'#1a1a1a', borderRadius:10, padding:12, alignItems:'center' },
  statValue: { color:'#fff', fontSize:20, fontWeight:'800' },
  statLabel: { color:'#555', fontSize:10, textTransform:'uppercase', marginTop:3 },
  card: { backgroundColor:'#1a1a1a', borderRadius:12, margin:16, padding:14 },
  sectionTitle: { color:'#aaa', fontSize:12, fontWeight:'600', textTransform:'uppercase', letterSpacing:1, marginBottom:10 },
  row: { flexDirection:'row', paddingBottom:8, marginBottom:0 },
  c1: { flex:2, color:'#ccc', fontSize:13 },
  c2: { flex:1.5, color:'#fff', fontSize:13, fontWeight:'700', textAlign:'right' },
  c3: { flex:2, fontSize:13, fontWeight:'700', textAlign:'right' },
});
