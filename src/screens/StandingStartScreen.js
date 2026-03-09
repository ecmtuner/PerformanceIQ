import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { shareRun } from '../utils/share';
import { saveRun, getCarProfile } from '../utils/storage';

const BRACKETS = [
  { label: '0 – 60 MPH', value: '0_60', factor: 0.08 },
  { label: '0 – 100 MPH', value: '0_100', factor: 0.10 },
];

export default function StandingStartScreen() {
  const [bracket, setBracket] = useState(BRACKETS[0]);
  const [measuredTime, setMeasuredTime] = useState('');
  const [slope, setSlope] = useState('');
  const [result, setResult] = useState(null);

  const calculate = async () => {
    const time = parseFloat(measuredTime);
    const grade = parseFloat(slope);
    if (isNaN(time) || isNaN(grade)) return;
    const delta = grade * bracket.factor;
    const corrected = time - delta;
    const car = await getCarProfile();
    setResult({ corrected: corrected.toFixed(3), delta: Math.abs(delta).toFixed(3), uphill: grade > 0, car });
  };

  const handleSave = async () => {
    const car = result.car;
    await saveRun({
      type: '0-60/0-100', bracket: bracket.label,
      rawTime: measuredTime, correctedTime: result.corrected,
      slope: parseFloat(slope), delta: result.delta,
      car: car ? `${car.year} ${car.make} ${car.model}`.trim() : null,
    });
    Alert.alert('Saved! ✅', 'Run saved to your logbook.');
  };

  const handleShare = () => {
    shareRun({
      type: '0-60/0-100', bracket: bracket.label,
      measuredTime, correctedTime: result.corrected,
      slope: parseFloat(slope), delta: result.delta,
      car: result.car ? `${result.car.year} ${result.car.make} ${result.car.model}`.trim() : null,
    });
  };

  const reset = () => { setMeasuredTime(''); setSlope(''); setResult(null); };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
      <Text style={styles.title}>0-60 / 0-100</Text>
      <Text style={styles.subtitle}>Slope Corrector</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Speed Bracket</Text>
        {BRACKETS.map((b) => (
          <TouchableOpacity key={b.value} style={[styles.bracketBtn, bracket.value === b.value && styles.bracketBtnActive]}
            onPress={() => { setBracket(b); setResult(null); }}>
            <Text style={[styles.bracketBtnText, bracket.value === b.value && styles.bracketBtnTextActive]}>{b.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Measured Time (seconds)</Text>
        <TextInput style={styles.input} value={measuredTime} onChangeText={setMeasuredTime}
          keyboardType="decimal-pad" placeholder="e.g. 3.850" placeholderTextColor="#555" blurOnSubmit={false} returnKeyType="next" />
        <Text style={[styles.label, { marginTop: 16 }]}>Road Slope %</Text>
        <Text style={styles.hint}>Positive = uphill  ·  Negative = downhill</Text>
        <TextInput style={styles.input} value={slope} onChangeText={setSlope}
          keyboardType="numbers-and-punctuation" placeholder="e.g. -1.5  or  +2.0" placeholderTextColor="#555" blurOnSubmit={false} returnKeyType="done" />
      </View>
      <TouchableOpacity style={styles.calcBtn} onPress={calculate}>
        <Text style={styles.calcBtnText}>CALCULATE</Text>
      </TouchableOpacity>
      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Corrected Time</Text>
          <Text style={styles.resultValue}>{result.corrected}s</Text>
          <View style={styles.divider} />
          <Text style={styles.deltaLabel}>
            {result.uphill ? `⬆️ Uphill cost you +${result.delta}s` : `⬇️ Downhill gave you -${result.delta}s`}
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>💾 Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Text style={styles.shareBtnText}>📤 Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetBtn} onPress={reset}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  title: { color: '#e51515', fontSize: 28, fontWeight: '800', marginTop: 12 },
  subtitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 20 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 14 },
  label: { color: '#aaa', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { color: '#555', fontSize: 11, marginBottom: 8 },
  bracketBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 8 },
  bracketBtnActive: { borderColor: '#e51515', backgroundColor: '#1e0000' },
  bracketBtnText: { color: '#888', fontSize: 15, fontWeight: '600' },
  bracketBtnTextActive: { color: '#e51515' },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 8, color: '#fff', fontSize: 20, padding: 12, fontWeight: '700' },
  calcBtn: { backgroundColor: '#e51515', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 20 },
  calcBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 2 },
  resultCard: { backgroundColor: '#111', borderWidth: 1, borderColor: '#e51515', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 40 },
  resultLabel: { color: '#aaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  resultValue: { color: '#e51515', fontSize: 52, fontWeight: '800', marginVertical: 8 },
  divider: { height: 1, backgroundColor: '#222', width: '100%', marginVertical: 12 },
  deltaLabel: { color: '#ccc', fontSize: 15, textAlign: 'center', marginBottom: 16 },
  actionRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  saveBtn: { backgroundColor: '#1a3a1a', borderWidth: 1, borderColor: '#4caf50', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  saveBtnText: { color: '#4caf50', fontWeight: '700', fontSize: 14 },
  shareBtn: { backgroundColor: '#1a1a3a', borderWidth: 1, borderColor: '#5588ff', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  shareBtnText: { color: '#5588ff', fontWeight: '700', fontSize: 14 },
  resetBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  resetBtnText: { color: '#888', fontSize: 14 },
});
