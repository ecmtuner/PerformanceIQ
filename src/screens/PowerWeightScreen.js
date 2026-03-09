import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { getCarProfile } from '../utils/storage';

const FAMOUS_CARS = [
  { name: 'Bugatti Chiron', hp: 1479, weight: 4398 },
  { name: 'Koenigsegg Jesko', hp: 1600, weight: 3131 },
  { name: 'Ferrari SF90', hp: 986, weight: 3461 },
  { name: 'Lamborghini Huracán STO', hp: 631, weight: 2952 },
  { name: 'Porsche 911 GT3 RS', hp: 518, weight: 3268 },
  { name: 'McLaren 720S', hp: 710, weight: 3153 },
  { name: 'BMW M3 Competition', hp: 503, weight: 3840 },
  { name: 'Mercedes-AMG GT63S', hp: 630, weight: 4700 },
  { name: 'Audi RS6 Avant', hp: 591, weight: 4740 },
  { name: 'Dodge Challenger SRT Demon', hp: 840, weight: 4280 },
  { name: 'Tesla Model S Plaid', hp: 1020, weight: 4766 },
  { name: 'Toyota Supra A90', hp: 382, weight: 3397 },
  { name: 'Nissan GT-R R35', hp: 565, weight: 3840 },
  { name: 'Ford Mustang Shelby GT500', hp: 760, weight: 4225 },
  { name: 'Chevrolet Corvette Z06', hp: 670, weight: 3366 },
];

export default function PowerWeightScreen() {
  const [hp, setHp] = useState('');
  const [weight, setWeight] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    getCarProfile().then(p => {
      if (p) { if (p.hp) setHp(p.hp); if (p.weight) setWeight(p.weight); }
    });
  }, []);

  const calculate = () => {
    const h = parseFloat(hp), w = parseFloat(weight);
    if (isNaN(h) || isNaN(w) || w === 0) return;
    const ratio = (w / h).toFixed(2);
    const hpPerTon = ((h / w) * 2000).toFixed(1);
    const myRatio = w / h;
    const ranked = [...FAMOUS_CARS]
      .map(c => ({ ...c, ratio: c.weight / c.hp }))
      .sort((a, b) => a.ratio - b.ratio);
    const position = ranked.findIndex(c => myRatio <= c.ratio);
    setResult({ ratio, hpPerTon, ranked, myRatio, position: position === -1 ? ranked.length : position });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
        <Text style={styles.title}>Power-to-Weight</Text>
        <Text style={styles.subtitle}>How do you stack up?</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Wheel HP</Text>
          <TextInput style={styles.input} value={hp} onChangeText={setHp} keyboardType="decimal-pad" placeholder="e.g. 520" placeholderTextColor="#555" blurOnSubmit={false} returnKeyType="next" />
          <Text style={[styles.label, { marginTop: 14 }]}>Car Weight (lbs) with driver</Text>
          <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="e.g. 3800" placeholderTextColor="#555" blurOnSubmit={false} returnKeyType="done" />
        </View>
        <TouchableOpacity style={styles.calcBtn} onPress={calculate}>
          <Text style={styles.calcBtnText}>CALCULATE</Text>
        </TouchableOpacity>
        {result && (
          <>
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Lbs per HP</Text>
              <Text style={styles.resultValue}>{result.ratio}</Text>
              <Text style={styles.resultSub}>{result.hpPerTon} HP per ton</Text>
            </View>
            <Text style={styles.sectionHeader}>📊 How You Compare</Text>
            {result.ranked.map((car, i) => {
              const isMe = i === result.position;
              const before = i === result.position - 1;
              return (
                <React.Fragment key={car.name}>
                  {isMe && (
                    <View style={styles.myRow}>
                      <Text style={styles.myLabel}>👉 YOUR CAR</Text>
                      <Text style={styles.myRatio}>{result.ratio} lbs/hp</Text>
                    </View>
                  )}
                  <View style={[styles.carRow, i % 2 === 0 && styles.carRowAlt]}>
                    <Text style={styles.carRank}>#{i + 1}</Text>
                    <Text style={styles.carName} numberOfLines={1}>{car.name}</Text>
                    <Text style={styles.carRatio}>{car.ratio.toFixed(2)}</Text>
                  </View>
                </React.Fragment>
              );
            })}
            {result.position >= result.ranked.length && (
              <View style={styles.myRow}>
                <Text style={styles.myLabel}>👉 YOUR CAR (most powerful)</Text>
                <Text style={styles.myRatio}>{result.ratio} lbs/hp</Text>
              </View>
            )}
          </>
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
  resultCard: { backgroundColor: '#111', borderWidth: 1, borderColor: '#e51515', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 20 },
  resultLabel: { color: '#aaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  resultValue: { color: '#e51515', fontSize: 52, fontWeight: '800', marginVertical: 4 },
  resultSub: { color: '#888', fontSize: 14 },
  sectionHeader: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  myRow: { backgroundColor: '#1e0000', borderWidth: 1, borderColor: '#e51515', borderRadius: 8, padding: 12, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  myLabel: { color: '#e51515', fontWeight: '700', fontSize: 13 },
  myRatio: { color: '#e51515', fontWeight: '800', fontSize: 13 },
  carRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 },
  carRowAlt: { backgroundColor: '#111' },
  carRank: { color: '#555', fontSize: 12, width: 28 },
  carName: { color: '#ccc', fontSize: 13, flex: 1 },
  carRatio: { color: '#888', fontSize: 13, fontWeight: '600' },
});
