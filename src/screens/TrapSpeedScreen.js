import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default function TrapSpeedScreen() {
  const [measuredSpeed, setMeasuredSpeed] = useState('');
  const [slope, setSlope] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    const speed = parseFloat(measuredSpeed);
    const grade = parseFloat(slope);
    if (isNaN(speed) || isNaN(grade)) return;

    // Physics: v_corrected² = v_measured² + 2 * g * grade_fraction * distance (1/4 mile = 1320 ft)
    const g = 32.174; // ft/s²
    const distance = 1320; // ft (1/4 mile)
    const gradeDecimal = grade / 100;
    const speedFtS = speed * 1.46667;
    const correctedFtS2 = speedFtS * speedFtS + 2 * g * gradeDecimal * distance;
    const correctedSpeed = Math.sqrt(Math.abs(correctedFtS2)) / 1.46667 * (correctedFtS2 < 0 ? -1 : 1);
    const delta = Math.abs(correctedSpeed - speed);

    setResult({
      corrected: correctedSpeed.toFixed(2),
      delta: delta.toFixed(2),
      uphill: grade > 0,
    });
  };

  const reset = () => { setMeasuredSpeed(''); setSlope(''); setResult(null); };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
      <Text style={styles.title}>Trap Speed</Text>
      <Text style={styles.subtitle}>Corrector (1/4 Mile)</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Measured Trap Speed (MPH)</Text>
        <TextInput style={styles.input} value={measuredSpeed} onChangeText={v => { setMeasuredSpeed(v); setResult(null); }}
          keyboardType="decimal-pad" placeholder="e.g. 115.40" placeholderTextColor="#555" />
        <Text style={[styles.label, { marginTop: 16 }]}>Road Slope %</Text>
        <Text style={styles.hint}>Positive = uphill  ·  Negative = downhill</Text>
        <TextInput style={styles.input} value={slope} onChangeText={v => { setSlope(v); setResult(null); }}
          keyboardType="numbers-and-punctuation" placeholder="e.g. -1.5  or  +2.0" placeholderTextColor="#555" />
      </View>

      <TouchableOpacity style={styles.calcBtn} onPress={calculate}>
        <Text style={styles.calcBtnText}>CALCULATE</Text>
      </TouchableOpacity>

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Corrected Trap Speed</Text>
          <Text style={styles.resultValue}>{result.corrected} mph</Text>
          <View style={styles.divider} />
          <Text style={styles.deltaLabel}>
            {result.uphill
              ? `⬆️ Uphill cost you -${result.delta} mph`
              : `⬇️ Downhill gave you +${result.delta} mph`}
          </Text>
          <TouchableOpacity onPress={reset} style={styles.resetBtn}>
            <Text style={styles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
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
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 8, color: '#fff', fontSize: 20, padding: 12, fontWeight: '700' },
  calcBtn: { backgroundColor: '#e51515', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 20 },
  calcBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 2 },
  resultCard: { backgroundColor: '#111', borderWidth: 1, borderColor: '#e51515', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 40 },
  resultLabel: { color: '#aaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  resultValue: { color: '#e51515', fontSize: 44, fontWeight: '800', marginVertical: 8 },
  divider: { height: 1, backgroundColor: '#222', width: '100%', marginVertical: 12 },
  deltaLabel: { color: '#ccc', fontSize: 15, textAlign: 'center', marginBottom: 16 },
  resetBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 8 },
  resetBtnText: { color: '#888', fontSize: 14 },
});
