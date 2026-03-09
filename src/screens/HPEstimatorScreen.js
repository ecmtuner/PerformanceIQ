import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default function HPEstimatorScreen() {
  const [weight, setWeight] = useState('');
  const [trapSpeed, setTrapSpeed] = useState('');
  const [et, setEt] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    const w = parseFloat(weight);
    const trap = parseFloat(trapSpeed);
    const elapsed = parseFloat(et);
    if (isNaN(w)) return;

    let hpFromTrap = null, hpFromET = null, predictedET = null, predictedTrap = null;

    // Trap speed method (most accurate): HP = Weight × (Trap/234)^3
    if (!isNaN(trap)) {
      hpFromTrap = Math.round(w * Math.pow(trap / 234, 3));
    }

    // ET method: HP = Weight × (6.290/ET)^3
    if (!isNaN(elapsed)) {
      hpFromET = Math.round(w * Math.pow(6.290 / elapsed, 3));
    }

    // Predictions (if we have HP from one method, predict the other)
    const hp = hpFromTrap || hpFromET;
    if (hp) {
      predictedET = (6.290 * Math.pow(w / hp, 1/3)).toFixed(3);
      predictedTrap = (234 * Math.pow(hp / w, 1/3)).toFixed(1);
    }

    if (!hp) return;

    setResult({ hpFromTrap, hpFromET, predictedET, predictedTrap, hp });
  };

  const reset = () => { setWeight(''); setTrapSpeed(''); setEt(''); setResult(null); };

  const Field = ({ label, value, onChange, placeholder, hint }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <TextInput style={styles.input} value={value} onChangeText={v => { onChange(v); setResult(null); }}
        keyboardType="decimal-pad" placeholder={placeholder} placeholderTextColor="#555" />
    </View>
  );

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>HP Estimator</Text>
      <Text style={styles.subtitle}>From ET & Trap Speed</Text>

      <View style={styles.card}>
        <Field label="Car Weight (lbs) with driver" value={weight} onChange={setWeight} placeholder="e.g. 3200" hint="Include driver and full fuel tank" />
        <Field label="1/4 Mile Trap Speed (MPH)" value={trapSpeed} onChange={setTrapSpeed} placeholder="e.g. 115.40" hint="Most accurate method" />
        <Field label="1/4 Mile ET (seconds)" value={et} onChange={setEt} placeholder="e.g. 11.450" hint="Alternative if no trap speed" />
      </View>

      <TouchableOpacity style={styles.calcBtn} onPress={calculate}>
        <Text style={styles.calcBtnText}>CALCULATE</Text>
      </TouchableOpacity>

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Estimated HP (to the wheels)</Text>
          <Text style={styles.resultValue}>{result.hp} hp</Text>
          <View style={styles.divider} />

          {result.hpFromTrap && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>From Trap Speed</Text>
              <Text style={styles.rowValue}>{result.hpFromTrap} hp</Text>
            </View>
          )}
          {result.hpFromET && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>From ET</Text>
              <Text style={styles.rowValue}>{result.hpFromET} hp</Text>
            </View>
          )}

          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Predictions</Text>
          {result.predictedET && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Predicted 1/4 ET</Text>
              <Text style={styles.rowValue}>{result.predictedET}s</Text>
            </View>
          )}
          {result.predictedTrap && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Predicted Trap Speed</Text>
              <Text style={styles.rowValue}>{result.predictedTrap} mph</Text>
            </View>
          )}

          <Text style={styles.note}>Formula: HP = Weight × (Trap/234)³  ·  Lawson/Hale method</Text>
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
  label: { color: '#aaa', fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { color: '#555', fontSize: 11, marginBottom: 6 },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 8, color: '#fff', fontSize: 18, padding: 12, fontWeight: '700' },
  calcBtn: { backgroundColor: '#e51515', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 20 },
  calcBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 2 },
  resultCard: { backgroundColor: '#111', borderWidth: 1, borderColor: '#e51515', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 40 },
  resultLabel: { color: '#aaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  resultValue: { color: '#e51515', fontSize: 52, fontWeight: '800', marginVertical: 8 },
  divider: { height: 1, backgroundColor: '#222', width: '100%', marginVertical: 10 },
  sectionLabel: { color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 8 },
  rowLabel: { color: '#888', fontSize: 14 },
  rowValue: { color: '#fff', fontSize: 15, fontWeight: '700' },
  note: { color: '#444', fontSize: 11, textAlign: 'center', marginTop: 8, marginBottom: 12 },
  resetBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 8 },
  resetBtnText: { color: '#888', fontSize: 14 },
});
