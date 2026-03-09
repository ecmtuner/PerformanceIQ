import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { saveCarProfile, getCarProfile } from '../utils/storage';

export default function CarProfileScreen() {
  const [profile, setProfile] = useState({ year: '', make: '', model: '', weight: '', hp: '', tireSize: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => { getCarProfile().then(p => { if (p) { setProfile(p); setSaved(true); } }); }, []);

  const set = (key, val) => setProfile(p => ({ ...p, [key]: val }));

  const save = async () => {
    if (!profile.make || !profile.model) { Alert.alert('Required', 'Please enter at least make and model.'); return; }
    await saveCarProfile(profile);
    setSaved(true);
    Alert.alert('Saved! ✅', `${profile.year} ${profile.make} ${profile.model} saved to your profile.`);
  };

  const Field = ({ label, fieldKey, placeholder, hint, keyboard = 'default' }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <TextInput style={styles.input} value={profile[fieldKey]} onChangeText={v => set(fieldKey, v)}
        keyboardType={keyboard} placeholder={placeholder} placeholderTextColor="#555"
        blurOnSubmit={false} returnKeyType="next" />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
        <Text style={styles.title}>Car Profile</Text>
        <Text style={styles.subtitle}>Pre-fill your calculators</Text>
        {saved && <Text style={styles.savedBadge}>✅ Profile saved — calculators will use your car data</Text>}
        <View style={styles.card}>
          <Field label="Year" fieldKey="year" placeholder="e.g. 2019" keyboard="number-pad" />
          <Field label="Make" fieldKey="make" placeholder="e.g. BMW" />
          <Field label="Model" fieldKey="model" placeholder="e.g. M3 Competition" />
          <Field label="Weight (lbs) with driver" fieldKey="weight" placeholder="e.g. 3800" keyboard="decimal-pad" hint="Include yourself and full tank" />
          <Field label="Wheel HP" fieldKey="hp" placeholder="e.g. 520" keyboard="decimal-pad" />
          <Field label="Tire Size" fieldKey="tireSize" placeholder="e.g. 275/35R19" hint="Front tires for 0-60, rear for trap speed" />
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>💾  SAVE PROFILE</Text>
        </TouchableOpacity>
        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  title: { color: '#e51515', fontSize: 28, fontWeight: '800', marginTop: 12 },
  subtitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 16 },
  savedBadge: { color: '#4caf50', fontSize: 12, marginBottom: 14, textAlign: 'center' },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 14 },
  label: { color: '#aaa', fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { color: '#555', fontSize: 11, marginBottom: 6 },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 8, color: '#fff', fontSize: 16, padding: 12, fontWeight: '600' },
  saveBtn: { backgroundColor: '#e51515', borderRadius: 10, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 1 },
});
