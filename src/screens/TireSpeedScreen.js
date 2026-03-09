import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';

function parseTireSize(str) {
  const m = str.trim().match(/^(\d+)\/(\d+)[rR](\d+)$/);
  if (!m) return null;
  const width = parseInt(m[1]), ratio = parseInt(m[2]), rim = parseInt(m[3]);
  return (rim * 25.4 + 2 * width * (ratio / 100)) * Math.PI / (25.4 * 12 * 5280);
}

export default function TireSpeedScreen() {
  const [rpm, setRpm] = useState('');
  const [tireSize, setTireSize] = useState('');
  const [finalDrive, setFinalDrive] = useState('');
  const [gears, setGears] = useState(['', '', '', '', '', '']);
  const [result, setResult] = useState(null);

  const setGear = (i, v) => setGears(g => { const n = [...g]; n[i] = v; return n; });

  const calculate = () => {
    const r = parseFloat(rpm);
    const fd = parseFloat(finalDrive);
    const circ = parseTireSize(tireSize); // miles per revolution
    if (isNaN(r) || isNaN(fd) || !circ) return;

    const gearSpeeds = gears.map((g, i) => {
      const ratio = parseFloat(g);
      if (isNaN(ratio) || ratio === 0) return null;
      const speed = (r / (ratio * fd)) * circ * 60;
      return { gear: i + 1, ratio, speed: speed.toFixed(1) };
    }).filter(Boolean);

    if (gearSpeeds.length === 0) return;
    setResult(gearSpeeds);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
        <Text style={styles.title}>Tire Speed</Text>
        <Text style={styles.subtitle}>Speed per Gear at RPM</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Tire Size</Text>
          <TextInput style={styles.input} value={tireSize} onChangeText={setTireSize} placeholder="e.g. 255/35R19" placeholderTextColor="#555" autoCapitalize="none" blurOnSubmit={false} returnKeyType="next" />
          <Text style={[styles.label, { marginTop: 14 }]}>RPM</Text>
          <TextInput style={styles.input} value={rpm} onChangeText={setRpm} keyboardType="decimal-pad" placeholder="e.g. 7000" placeholderTextColor="#555" blurOnSubmit={false} returnKeyType="next" />
          <Text style={[styles.label, { marginTop: 14 }]}>Final Drive Ratio</Text>
          <TextInput style={styles.input} value={finalDrive} onChangeText={setFinalDrive} keyboardType="decimal-pad" placeholder="e.g. 3.46" placeholderTextColor="#555" blurOnSubmit={false} returnKeyType="next" />
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Gear Ratios</Text>
          <Text style={styles.hint}>Enter each gear's transmission ratio (fill only the gears you have)</Text>
          <View style={styles.gearsGrid}>
            {gears.map((g, i) => (
              <View key={i} style={styles.gearField}>
                <Text style={styles.gearLabel}>Gear {i + 1}</Text>
                <TextInput style={styles.gearInput} value={g} onChangeText={v => setGear(i, v)} keyboardType="decimal-pad" placeholder="ratio" placeholderTextColor="#555" blurOnSubmit={false} returnKeyType="next" />
              </View>
            ))}
          </View>
        </View>
        <TouchableOpacity style={styles.calcBtn} onPress={calculate}>
          <Text style={styles.calcBtnText}>CALCULATE</Text>
        </TouchableOpacity>
        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Speed at {rpm} RPM</Text>
            {result.map(({ gear, ratio, speed }) => (
              <View key={gear} style={styles.gearRow}>
                <Text style={styles.gearNum}>Gear {gear}</Text>
                <Text style={styles.gearRatioText}>({ratio})</Text>
                <Text style={styles.gearSpeed}>{speed} mph</Text>
              </View>
            ))}
            <TouchableOpacity onPress={() => setResult(null)} style={styles.resetBtn}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  title: { color: '#e51515', fontSize: 28, fontWeight: '800', marginTop: 12 },
  subtitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 16 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 14 },
  label: { color: '#aaa', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { color: '#555', fontSize: 11, marginBottom: 10 },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 8, color: '#fff', fontSize: 18, padding: 12, fontWeight: '700' },
  gearsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gearField: { width: '30%' },
  gearLabel: { color: '#666', fontSize: 11, marginBottom: 4 },
  gearInput: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 8, color: '#fff', fontSize: 16, padding: 10, fontWeight: '700', textAlign: 'center' },
  calcBtn: { backgroundColor: '#e51515', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 20 },
  calcBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 2 },
  resultCard: { backgroundColor: '#111', borderWidth: 1, borderColor: '#e51515', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 20 },
  resultLabel: { color: '#aaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  gearRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 10, justifyContent: 'space-between' },
  gearNum: { color: '#fff', fontWeight: '700', fontSize: 15, width: 60 },
  gearRatioText: { color: '#555', fontSize: 13, flex: 1 },
  gearSpeed: { color: '#e51515', fontWeight: '800', fontSize: 20 },
  resetBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 8, marginTop: 8 },
  resetBtnText: { color: '#888', fontSize: 14 },
});
