import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default function EthanolCalculatorScreen() {
  const [tankSize, setTankSize] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [currentEthanol, setCurrentEthanol] = useState('');
  const [targetEthanol, setTargetEthanol] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    const tank = parseFloat(tankSize);
    const level = parseFloat(currentLevel);
    const currE = parseFloat(currentEthanol) / 100;
    const targE = parseFloat(targetEthanol) / 100;
    const E85 = 0.85;

    if ([tank, level, currE, targE].some(isNaN)) return;
    if (level > tank) return;
    if (targE <= currE) { setResult({ error: 'Target must be higher than current ethanol %' }); return; }

    // Current ethanol volume in tank
    const currentEthanolGal = level * currE;
    // We need to find X = gallons of E85 to add
    // (currentEthanolGal + X * E85) / (level + X) = targE
    // Solve: X = (targE * level - currentEthanolGal) / (E85 - targE)
    const gallonsToAdd = (targE * level - currentEthanolGal) / (E85 - targE);

    if (gallonsToAdd < 0 || gallonsToAdd + level > tank) {
      setResult({ error: 'Cannot reach target with current tank space. Burn some fuel first.' });
      return;
    }

    const finalVolume = level + gallonsToAdd;
    const finalEthanolGal = currentEthanolGal + gallonsToAdd * E85;
    const finalEthanolPct = (finalEthanolGal / finalVolume) * 100;

    // Octane estimate: E0=87, E85=105, interpolate
    const octane = 87 + (finalEthanolPct / 85) * (105 - 87);

    setResult({
      gallonsToAdd: gallonsToAdd.toFixed(2),
      finalEthanolPct: finalEthanolPct.toFixed(1),
      finalVolume: finalVolume.toFixed(2),
      octane: Math.min(octane, 105).toFixed(1),
    });
  };

  const reset = () => {
    setTankSize(''); setCurrentLevel(''); setCurrentEthanol(''); setTargetEthanol(''); setResult(null);
  };

  const Field = ({ label, value, onChange, placeholder, hint }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(v) => { onChange(v); setResult(null); }}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor="#555"
      />
    </View>
  );

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Ethanol</Text>
      <Text style={styles.subtitle}>Mix Calculator</Text>

      <View style={styles.card}>
        <Field label="Tank Size (gallons)" value={tankSize} onChange={setTankSize} placeholder="e.g. 16.0" />
        <Field label="Current Fuel Level (gallons)" value={currentLevel} onChange={setCurrentLevel} placeholder="e.g. 8.0" hint="How much fuel is in the tank right now" />
        <Field label="Current Ethanol %" value={currentEthanol} onChange={setCurrentEthanol} placeholder="e.g. 10  (for E10 pump gas)" />
        <Field label="Target Ethanol %" value={targetEthanol} onChange={setTargetEthanol} placeholder="e.g. 40  (for E40 blend)" />
      </View>

      <TouchableOpacity style={styles.calcBtn} onPress={calculate}>
        <Text style={styles.calcBtnText}>CALCULATE MIX</Text>
      </TouchableOpacity>

      {result && (
        <View style={[styles.resultCard, result.error && styles.errorCard]}>
          {result.error ? (
            <Text style={styles.errorText}>{result.error}</Text>
          ) : (
            <>
              <Text style={styles.resultLabel}>Add E85</Text>
              <Text style={styles.resultValue}>{result.gallonsToAdd} gal</Text>
              <View style={styles.divider} />
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Final Mix</Text>
                  <Text style={styles.statValue}>E{result.finalEthanolPct}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Est. Octane</Text>
                  <Text style={styles.statValue}>{result.octane}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Total Fuel</Text>
                  <Text style={styles.statValue}>{result.finalVolume} gal</Text>
                </View>
              </View>
              <TouchableOpacity onPress={reset} style={styles.resetBtn}>
                <Text style={styles.resetBtnText}>Reset</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  title: { color: '#e51515', fontSize: 28, fontWeight: '800', marginTop: 12 },
  subtitle: { color: '#ffffff', fontSize: 18, fontWeight: '600', marginBottom: 20 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 14 },
  label: { color: '#aaa', fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { color: '#555', fontSize: 11, marginBottom: 6 },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 8, color: '#fff', fontSize: 18, padding: 12, fontWeight: '700' },
  calcBtn: { backgroundColor: '#e51515', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 20 },
  calcBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 2 },
  resultCard: { backgroundColor: '#111', borderWidth: 1, borderColor: '#e51515', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 40 },
  errorCard: { borderColor: '#aa4400' },
  errorText: { color: '#ff6633', fontSize: 15, textAlign: 'center' },
  resultLabel: { color: '#aaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  resultValue: { color: '#e51515', fontSize: 52, fontWeight: '800', marginVertical: 8 },
  divider: { height: 1, backgroundColor: '#222', width: '100%', marginVertical: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 16 },
  stat: { alignItems: 'center' },
  statLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
  resetBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 8 },
  resetBtnText: { color: '#888', fontSize: 14 },
});
