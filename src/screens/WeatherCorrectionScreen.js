import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default function WeatherCorrectionScreen() {
  const [temperature, setTemperature] = useState('');
  const [pressure, setPressure] = useState('');
  const [humidity, setHumidity] = useState('');
  const [measuredET, setMeasuredET] = useState('');
  const [measuredHP, setMeasuredHP] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    const tempF = parseFloat(temperature);
    const baro = parseFloat(pressure);
    const rh = parseFloat(humidity) || 0;
    if (isNaN(tempF) || isNaN(baro)) return;

    // SAE J1349 correction factor
    const tempC = (tempF - 32) * 5 / 9;
    const T = tempC + 273.15; // Kelvin
    const T_std = 298; // 25°C in Kelvin
    const P_mbar = baro * 33.8639; // inHg to mbar

    // Vapor pressure (Buck equation)
    const Psat = 6.1078 * Math.pow(10, (7.5 * tempC) / (237.3 + tempC));
    const Pv = (rh / 100) * Psat;
    const Pd = P_mbar - Pv; // dry air pressure in mbar

    // SAE J1349 CF
    const CF = (990 / Pd) * Math.sqrt(T_std / T);

    const et = parseFloat(measuredET);
    const hp = parseFloat(measuredHP);

    let correctedET = null, correctedHP = null;
    if (!isNaN(et)) {
      // ET scales with CF^(1/3) approximately
      correctedET = (et * Math.pow(CF, 1/3)).toFixed(3);
    }
    if (!isNaN(hp)) {
      correctedHP = Math.round(hp * CF);
    }

    const conditions = CF > 1.02 ? '🔴 Hot/humid — car is slower than standard'
      : CF < 0.98 ? '🟢 Cold/dry — car is faster than standard'
      : '🟡 Near standard conditions';

    setResult({ CF: CF.toFixed(4), correctedET, correctedHP, conditions, better: CF < 1 });
  };

  const reset = () => { setTemperature(''); setPressure(''); setHumidity(''); setMeasuredET(''); setMeasuredHP(''); setResult(null); };

  const Field = ({ label, value, onChange, placeholder, hint }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <TextInput style={styles.input} value={value} onChangeText={v => { onChange(v); setResult(null); }}
        keyboardType="decimal-pad" placeholder={placeholder} placeholderTextColor="#555" />
    </View>
  );

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
      <Text style={styles.title}>SAE Weather</Text>
      <Text style={styles.subtitle}>Correction Factor</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Weather Conditions</Text>
        <Field label="Temperature (°F)" value={temperature} onChange={setTemperature} placeholder="e.g. 85" />
        <Field label="Barometric Pressure (inHg)" value={pressure} onChange={setPressure} placeholder="e.g. 29.92" />
        <Field label="Humidity %" value={humidity} onChange={setHumidity} placeholder="e.g. 60" />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your Run (optional)</Text>
        <Field label="Measured ET (seconds)" value={measuredET} onChange={setMeasuredET} placeholder="e.g. 11.450" hint="Corrects your ET to SAE standard conditions" />
        <Field label="Measured HP (whp)" value={measuredHP} onChange={setMeasuredHP} placeholder="e.g. 450" hint="Corrects dyno HP to SAE standard" />
      </View>

      <TouchableOpacity style={styles.calcBtn} onPress={calculate}>
        <Text style={styles.calcBtnText}>CALCULATE</Text>
      </TouchableOpacity>

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>SAE Correction Factor</Text>
          <Text style={[styles.resultValue, { color: result.better ? '#4caf50' : '#e51515' }]}>{result.CF}</Text>
          <Text style={styles.condText}>{result.conditions}</Text>
          <View style={styles.divider} />
          {result.correctedET && (
            <View style={styles.corrRow}>
              <Text style={styles.corrLabel}>SAE Corrected ET</Text>
              <Text style={styles.corrValue}>{result.correctedET}s</Text>
            </View>
          )}
          {result.correctedHP && (
            <View style={styles.corrRow}>
              <Text style={styles.corrLabel}>SAE Corrected HP</Text>
              <Text style={styles.corrValue}>{result.correctedHP} hp</Text>
            </View>
          )}
          <Text style={styles.note}>CF {'>'} 1.00 = conditions worse than SAE standard (29.92 inHg, 77°F, 0% humidity)</Text>
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
  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 },
  label: { color: '#aaa', fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { color: '#555', fontSize: 11, marginBottom: 6 },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 8, color: '#fff', fontSize: 18, padding: 12, fontWeight: '700' },
  calcBtn: { backgroundColor: '#e51515', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 20 },
  calcBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 2 },
  resultCard: { backgroundColor: '#111', borderWidth: 1, borderColor: '#e51515', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 40 },
  resultLabel: { color: '#aaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  resultValue: { fontSize: 52, fontWeight: '800', marginVertical: 8 },
  condText: { fontSize: 14, color: '#ccc', textAlign: 'center', marginBottom: 4 },
  divider: { height: 1, backgroundColor: '#222', width: '100%', marginVertical: 12 },
  corrRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 10 },
  corrLabel: { color: '#888', fontSize: 14 },
  corrValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
  note: { color: '#444', fontSize: 11, textAlign: 'center', marginTop: 8, marginBottom: 12, lineHeight: 16 },
  resetBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 8 },
  resetBtnText: { color: '#888', fontSize: 14 },
});
