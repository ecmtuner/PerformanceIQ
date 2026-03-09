import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Keyboard, KeyboardAvoidingView, Platform, Share } from 'react-native';
import { saveRun, getCarProfile } from '../utils/storage';
import KeyboardToolbar from '../components/KeyboardToolbar';

const SPEED_KEY = 'trap_speed'; const SLOPE_KEY = 'trap_slope';

export default function TrapSpeedScreen() {
  const [measuredSpeed, setMeasuredSpeed] = useState('');
  const [slope, setSlope] = useState('');
  const [result, setResult] = useState(null);
  const speedRef = useRef(); const slopeRef = useRef();

  const calculate = async () => {
    Keyboard.dismiss();
    const speed = parseFloat(measuredSpeed), grade = parseFloat(slope);
    if (isNaN(speed) || isNaN(grade)) return;
    const g = 32.174, distance = 1320, gradeDecimal = grade / 100;
    const speedFtS = speed * 1.46667;
    const correctedFtS2 = speedFtS * speedFtS + 2 * g * gradeDecimal * distance;
    const correctedSpeed = Math.sqrt(Math.abs(correctedFtS2)) / 1.46667;
    const delta = Math.abs(correctedSpeed - speed);
    const car = await getCarProfile();
    setResult({ corrected: correctedSpeed.toFixed(2), delta: delta.toFixed(2), uphill: grade > 0, car });
  };

  const handleSave = async () => {
    await saveRun({ type: 'Trap Speed', bracket: '1/4 Mile', rawTime: measuredSpeed + ' mph', correctedTime: result.corrected + ' mph', slope: parseFloat(slope), delta: result.delta, car: result.car ? `${result.car.year} ${result.car.make} ${result.car.model}`.trim() : null });
    Alert.alert('Saved! ✅', 'Run saved to your logbook.');
  };

  const handleShare = async () => {
    const carProfile = await getCarProfile();
    const carName = carProfile ? [carProfile.year, carProfile.make, carProfile.model].filter(Boolean).join(' ') : null;
    const grade = parseFloat(slope);
    await Share.share({ message: ['⚡ PerformanceIQ — Trap Speed Corrected', carName ? `🚗 ${carName}` : '', `🏁 Raw Trap: ${measuredSpeed} mph`, `✅ Corrected: ${result.corrected} mph`, `📐 Slope: ${grade > 0 ? '+' : ''}${slope}%  (${result.delta} mph diff)`, '', '📲 PerformanceIQ App'].filter(Boolean).join('\n') });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <KeyboardToolbar inputAccessoryViewID={SPEED_KEY} onNext={() => slopeRef.current?.focus()} onDone={Keyboard.dismiss} />
      <KeyboardToolbar inputAccessoryViewID={SLOPE_KEY} onDone={Keyboard.dismiss} />
      <ScrollView style={styles.container} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
        <Text style={styles.title}>Trap Speed</Text>
        <Text style={styles.subtitle}>Corrector (1/4 Mile)</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Measured Trap Speed (MPH)</Text>
          <TextInput ref={speedRef} style={styles.input} value={measuredSpeed} onChangeText={setMeasuredSpeed} keyboardType="decimal-pad" placeholder="e.g. 115.40" placeholderTextColor="#555" inputAccessoryViewID={SPEED_KEY} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => slopeRef.current?.focus()} />
          <Text style={[styles.label, { marginTop: 16 }]}>Road Slope %</Text>
          <Text style={styles.hint}>Positive = uphill  ·  Negative = downhill</Text>
          <TextInput ref={slopeRef} style={styles.input} value={slope} onChangeText={setSlope} keyboardType="numbers-and-punctuation" placeholder="e.g. -1.5  or  +2.0" placeholderTextColor="#555" inputAccessoryViewID={SLOPE_KEY} returnKeyType="done" blurOnSubmit={true} onSubmitEditing={Keyboard.dismiss} />
        </View>
        <TouchableOpacity style={styles.calcBtn} onPress={calculate}><Text style={styles.calcBtnText}>CALCULATE</Text></TouchableOpacity>
        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Corrected Trap Speed</Text>
            <Text style={styles.resultValue}>{result.corrected} mph</Text>
            <View style={styles.divider} />
            <Text style={styles.deltaLabel}>{result.uphill ? `⬆️ Uphill cost you -${result.delta} mph` : `⬇️ Downhill gave you +${result.delta} mph`}</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}><Text style={styles.saveBtnText}>💾 Save</Text></TouchableOpacity>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare}><Text style={styles.shareBtnText}>📤 Share</Text></TouchableOpacity>
              <TouchableOpacity style={styles.resetBtn} onPress={() => { setMeasuredSpeed(''); setSlope(''); setResult(null); }}><Text style={styles.resetBtnText}>Reset</Text></TouchableOpacity>
            </View>
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
  actionRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  saveBtn: { backgroundColor: '#1a3a1a', borderWidth: 1, borderColor: '#4caf50', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  saveBtnText: { color: '#4caf50', fontWeight: '700', fontSize: 14 },
  shareBtn: { backgroundColor: '#1a1a3a', borderWidth: 1, borderColor: '#5588ff', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  shareBtnText: { color: '#5588ff', fontWeight: '700', fontSize: 14 },
  resetBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  resetBtnText: { color: '#888', fontSize: 14 },
});
