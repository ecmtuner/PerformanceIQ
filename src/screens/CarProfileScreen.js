import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { saveCarProfile, getCarProfile } from '../utils/storage';
import { getLocalUser } from '../services/AuthService';
import { getConnectedCar } from '../services/CarDataStore';

const EMPTY_PROFILE = {
  year: '', make: '', model: '', weight: '', hp: '', tireSize: '', engine: '', mods: []
};

export default function CarProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [saved, setSaved] = useState(false);
  const [newMod, setNewMod] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);

  // Check auth on every focus (so returning from AuthScreen works)
  useFocusEffect(useCallback(() => {
    getLocalUser().then(u => {
      setUser(u);
      setAuthChecked(true);
      if (!u && navigation) {
        navigation.replace('Auth');
      }
    });
    getCarProfile().then(p => {
      if (p) { setProfile({ ...EMPTY_PROFILE, ...p, mods: p.mods || [] }); setSaved(true); }
    });
  }, []));

  const set = (key, val) => setProfile(p => ({ ...p, [key]: val }));

  // Fill from OBD2-connected car
  const fillFromOBD2 = () => {
    const car = getConnectedCar();
    if (!car) {
      Alert.alert('Not Connected', 'No OBD2 car is currently connected.\n\nGo to the OBD2 Scanner screen and connect your car first.');
      return;
    }
    setProfile(p => ({
      ...p,
      make: car.make || p.make,
      model: car.model || p.model,
      year: car.year || p.year,
      engine: car.engine || p.engine,
    }));
    Alert.alert('✅ Filled from OBD2', `${car.year} ${car.make} ${car.model}\n${car.engine}`);
  };

  // Mod list
  const addMod = () => {
    const trimmed = newMod.trim();
    if (!trimmed) return;
    if (profile.mods.includes(trimmed)) { Alert.alert('Already added', `"${trimmed}" is already in your mod list.`); return; }
    setProfile(p => ({ ...p, mods: [...p.mods, trimmed] }));
    setNewMod('');
  };
  const removeMod = (mod) => setProfile(p => ({ ...p, mods: p.mods.filter(m => m !== mod) }));

  const save = async () => {
    if (!profile.make || !profile.model) {
      Alert.alert('Required', 'Please enter at least make and model.');
      return;
    }
    await saveCarProfile(profile);
    setSaved(true);
    Alert.alert('Saved! ✅', `${profile.year} ${profile.make} ${profile.model} saved to your profile.`);
  };

  const Field = ({ label, fieldKey, placeholder, hint, keyboard = 'default' }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <TextInput
        style={styles.input}
        value={profile[fieldKey]}
        onChangeText={v => set(fieldKey, v)}
        keyboardType={keyboard}
        placeholder={placeholder}
        placeholderTextColor="#555"
        blurOnSubmit={false}
        returnKeyType="next"
      />
    </View>
  );

  if (!authChecked) {
    return <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color="#e51515" size="large" />
    </View>;
  }

  if (!user) return null; // redirect already triggered

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="always" keyboardDismissMode="none">

        {/* Header */}
        <Text style={styles.title}>Car Profile</Text>
        <Text style={styles.subtitle}>Pre-fill your car info</Text>
        <Text style={styles.userLine}>👤 {user.displayName || user.email}</Text>

        {saved && (
          <Text style={styles.savedBadge}>✅ Profile saved — used for calculators & leaderboard submissions</Text>
        )}

        {/* OBD2 Fill Button */}
        <TouchableOpacity style={styles.obd2Btn} onPress={fillFromOBD2}>
          <Text style={styles.obd2BtnTxt}>🔌  Add Car via OBD2</Text>
          <Text style={styles.obd2BtnHint}>Auto-fills make, model, year & engine from live connection</Text>
        </TouchableOpacity>

        {/* Car Info Card */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🚗 Vehicle Info</Text>
        </View>
        <View style={styles.card}>
          <Field label="Year"    fieldKey="year"     placeholder="e.g. 2019"              keyboard="number-pad" />
          <Field label="Make"    fieldKey="make"     placeholder="e.g. BMW" />
          <Field label="Model"   fieldKey="model"    placeholder="e.g. M3 Competition" />
          <Field label="Engine"  fieldKey="engine"   placeholder="e.g. S58 3.0L Twin Turbo" />
          <Field label="Weight (lbs) with driver" fieldKey="weight" placeholder="e.g. 3800" keyboard="decimal-pad" hint="Include yourself and full tank" />
          <Field label="Wheel HP" fieldKey="hp"      placeholder="e.g. 520"               keyboard="decimal-pad" />
          <Field label="Tire Size" fieldKey="tireSize" placeholder="e.g. 275/35R19"       hint="Front for 0-60, rear for trap speed" />
        </View>

        {/* Mod List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🔧 Mod List</Text>
          <Text style={styles.sectionHint}>Shown on leaderboard submissions</Text>
        </View>
        <View style={styles.card}>
          {profile.mods.length === 0 && (
            <Text style={styles.emptyMods}>No mods added yet. Add your bolt-ons, tune, exhaust, etc.</Text>
          )}
          {profile.mods.map((mod, i) => (
            <View key={i} style={styles.modRow}>
              <Text style={styles.modBullet}>•</Text>
              <Text style={styles.modText}>{mod}</Text>
              <TouchableOpacity onPress={() => removeMod(mod)} style={styles.modRemove}>
                <Text style={styles.modRemoveTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Add mod input */}
          <View style={styles.addModRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={newMod}
              onChangeText={setNewMod}
              placeholder="e.g. Stage 2 ECU tune, Downpipe, FMIC..."
              placeholderTextColor="#444"
              returnKeyType="done"
              onSubmitEditing={addMod}
            />
            <TouchableOpacity style={styles.addModBtn} onPress={addMod}>
              <Text style={styles.addModBtnTxt}>+ Add</Text>
            </TouchableOpacity>
          </View>
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
  subtitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  userLine: { color: '#444', fontSize: 12, marginBottom: 14 },
  savedBadge: { color: '#4caf50', fontSize: 12, marginBottom: 14, textAlign: 'center' },

  obd2Btn: {
    backgroundColor: '#0a1a0a', borderWidth: 1, borderColor: '#2a5a2a',
    borderRadius: 12, padding: 14, marginBottom: 20, alignItems: 'center',
  },
  obd2BtnTxt: { color: '#4caf50', fontWeight: '800', fontSize: 15 },
  obd2BtnHint: { color: '#2a5a2a', fontSize: 11, marginTop: 4, textAlign: 'center' },

  sectionHeader: { marginBottom: 8 },
  sectionTitle: { color: '#aaa', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  sectionHint: { color: '#333', fontSize: 11, marginTop: 2 },

  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 20 },
  label: { color: '#aaa', fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { color: '#555', fontSize: 11, marginBottom: 6 },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 8, color: '#fff', fontSize: 16, padding: 12, fontWeight: '600' },

  emptyMods: { color: '#333', fontSize: 13, marginBottom: 14, fontStyle: 'italic' },
  modRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#111' },
  modBullet: { color: '#e51515', fontSize: 16, marginRight: 8 },
  modText: { flex: 1, color: '#ccc', fontSize: 14 },
  modRemove: { padding: 4 },
  modRemoveTxt: { color: '#444', fontSize: 14, fontWeight: '700' },

  addModRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  addModBtn: { backgroundColor: '#1e2a1e', borderWidth: 1, borderColor: '#2a5a2a', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  addModBtnTxt: { color: '#4caf50', fontWeight: '800', fontSize: 13 },

  saveBtn: { backgroundColor: '#e51515', borderRadius: 10, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 1 },
});
