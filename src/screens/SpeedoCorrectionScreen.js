import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';

function parseTireSize(str) {
  const m = str.trim().match(/^(\d+)\/(\d+)[rR](\d+)$/);
  if (!m) return null;
  const width = parseInt(m[1]), ratio = parseInt(m[2]), rim = parseInt(m[3]);
  const sidewall = width * (ratio / 100);
  const diamMM = rim * 25.4 + 2 * sidewall;
  return diamMM;
}

export default function SpeedoCorrectionScreen() {
  const [origSize, setOrigSize] = useState('');
  const [newSize, setNewSize] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    const origD = parseTireSize(origSize);
    const newD = parseTireSize(newSize);
    if (!origD || !newD) { setResult({ error: 'Invalid tire size. Use format like 255/35R19' }); return; }
    const correction = (newD / origD);
    const pctDiff = ((correction - 1) * 100).toFixed(2);
    const speedo60 = (60 / correction).toFixed(1);
    const speedo80 = (80 / correction).toFixed(1);
    const speedo100 = (100 / correction).toFixed(1);
    const speedo130 = (130 / correction).toFixed(1);
    setResult({ pctDiff, correction: correction.toFixed(4), speedo60, speedo80, speedo100, speedo130, bigger: newD > origD });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
        <Text style={styles.title}>Speedo Correction</Text>
        <Text style={styles.subtitle}>After Tire Size Change</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Original Tire Size</Text>
          <TextInput style={styles.input} value={origSize} onChangeText={setOrigSize} placeholder="e.g. 225/45R18" placeholderTextColor="#555" autoCapitalize="none" blurOnSubmit={false} returnKeyType="next" />
          <Text style={[styles.label, { marginTop: 14 }]}>New Tire Size</Text>
          <TextInput style={styles.input} value={newSize} onChangeText={setNewSize} placeholder="e.g. 255/35R19" placeholderTextColor="#555" autoCapitalize="none" blurOnSubmit={false} returnKeyType="done" />
        </View>
        <TouchableOpacity style={styles.calcBtn} onPress={calculate}>
          <Text style={styles.calcBtnText}>CALCULATE</Text>
        </TouchableOpacity>
        {result && result.error && <View style={styles.errorBox}><Text style={styles.errorText}>{result.error}</Text></View>}
        {result && !result.error && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Speedometer Error</Text>
            <Text style={[styles.resultValue, { color: result.bigger ? '#ff9800' : '#4caf50' }]}>
              {result.bigger ? '+' : ''}{result.pctDiff}%
            </Text>
            <Text style={styles.resultSub}>
              {result.bigger
                ? `Bigger tires — speedo reads LOW (you're going faster than it shows)`
                : `Smaller tires — speedo reads HIGH (you're going slower than it shows)`}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.tableHeader}>Indicated → True Speed</Text>
            {[['60 mph', result.speedo60], ['80 mph', result.speedo80], ['100 mph', result.speedo100], ['130 mph', result.speedo130]].map(([ind, true_]) => (
              <View key={ind} style={styles.tableRow}>
                <Text style={styles.tableLabel}>Speedo shows {ind}</Text>
                <Text style={styles.tableValue}>True: {true_} mph</Text>
              </View>
            ))}
            <TouchableOpacity onPress={() => { setOrigSize(''); setNewSize(''); setResult(null); }} style={styles.resetBtn}>
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
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 8, color: '#fff', fontSize: 18, padding: 12, fontWeight: '700' },
  calcBtn: { backgroundColor: '#e51515', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 20 },
  calcBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 2 },
  errorBox: { backgroundColor: '#1a0a00', borderWidth: 1, borderColor: '#aa4400', borderRadius: 10, padding: 14, marginBottom: 14 },
  errorText: { color: '#ff6633', fontSize: 14 },
  resultCard: { backgroundColor: '#111', borderWidth: 1, borderColor: '#e51515', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 20 },
  resultLabel: { color: '#aaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  resultValue: { fontSize: 48, fontWeight: '800', marginVertical: 8 },
  resultSub: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 4 },
  divider: { height: 1, backgroundColor: '#222', width: '100%', marginVertical: 12 },
  tableHeader: { color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, alignSelf: 'flex-start' },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 8 },
  tableLabel: { color: '#888', fontSize: 14 },
  tableValue: { color: '#fff', fontSize: 14, fontWeight: '700' },
  resetBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 8, marginTop: 8 },
  resetBtnText: { color: '#888', fontSize: 14 },
});
