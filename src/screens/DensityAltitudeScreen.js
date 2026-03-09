import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Location from 'expo-location';

const FIELD_ORDER = ['elevation', 'temperature', 'pressure', 'humidity'];

export default function DensityAltitudeScreen() {
  const [fields, setFields] = useState({ elevation: '', temperature: '', pressure: '', humidity: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const refs = { elevation: useRef(), temperature: useRef(), pressure: useRef(), humidity: useRef() };

  const setField = (key, val) => setFields(f => ({ ...f, [key]: val }));

  // Auto-fill from GPS + Open-Meteo API
  const autoFill = async () => {
    setLoading(true);
    setAutoFilled(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLoading(false); return; }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude, altitude } = loc.coords;

      // Open-Meteo: free, no API key, returns current weather
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&current=temperature_2m,relative_humidity_2m,surface_pressure&temperature_unit=fahrenheit&timezone=auto`;
      const res = await fetch(url);
      const data = await res.json();
      const current = data.current;

      // surface_pressure is in hPa → convert to inHg (÷ 33.8639)
      const pressureInHg = (current.surface_pressure / 33.8639).toFixed(2);
      const tempF = current.temperature_2m.toFixed(1);
      const humidity = Math.round(current.relative_humidity_2m).toString();
      // Altitude from GPS (meters → feet), fallback to 0
      const elevFt = altitude ? Math.round(altitude * 3.28084).toString() : '0';

      setFields({
        elevation: elevFt,
        temperature: tempF,
        pressure: pressureInHg,
        humidity: humidity,
      });
      setAutoFilled(true);
    } catch (e) {
      // silently fail, user can enter manually
    }
    setLoading(false);
  };

  const calculate = () => {
    const elev = parseFloat(fields.elevation) || 0;
    const tempF = parseFloat(fields.temperature);
    const baro = parseFloat(fields.pressure);
    const rh = parseFloat(fields.humidity) || 0;
    if (isNaN(tempF) || isNaN(baro)) return;

    const PA = elev + (29.92 - baro) * 1000;
    const ISA_temp = 59 - (elev / 1000) * 3.5;
    let DA = PA + 120 * (tempF - ISA_temp);

    if (rh > 0) {
      const tempC = (tempF - 32) * 5 / 9;
      const Psat = 6.1078 * Math.pow(10, (7.5 * tempC) / (237.3 + tempC));
      const Pv = (rh / 100) * Psat;
      DA += Pv * 100;
    }

    const daRounded = Math.round(DA);
    let rating, ratingColor;
    if (DA < 1000) { rating = '🟢 Excellent — rip it'; ratingColor = '#4caf50'; }
    else if (DA < 3000) { rating = '🟡 Good conditions'; ratingColor = '#ffeb3b'; }
    else if (DA < 5000) { rating = '🟠 Fair conditions'; ratingColor = '#ff9800'; }
    else { rating = '🔴 Poor — air is thin'; ratingColor = '#e51515'; }

    const powerLoss = ((DA / 1000) * 3).toFixed(1);
    setResult({ DA: daRounded, PA: Math.round(PA), rating, ratingColor, powerLoss });
  };

  const reset = () => {
    setFields({ elevation: '', temperature: '', pressure: '', humidity: '' });
    setResult(null);
    setAutoFilled(false);
  };

  const InputField = ({ fieldKey, label, placeholder, hint, isLast }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <TextInput
        ref={refs[fieldKey]}
        style={styles.input}
        value={fields[fieldKey]}
        onChangeText={val => setField(fieldKey, val)}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor="#555"
        returnKeyType={isLast ? 'done' : 'next'}
        blurOnSubmit={isLast}
        onSubmitEditing={() => {
          if (!isLast) {
            const nextKey = FIELD_ORDER[FIELD_ORDER.indexOf(fieldKey) + 1];
            refs[nextKey]?.current?.focus();
          }
        }}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="always" keyboardDismissMode="none">

        <Text style={styles.title}>Density Altitude</Text>
        <Text style={styles.subtitle}>Racing Conditions</Text>

        {/* Auto-fill button */}
        <TouchableOpacity style={styles.autoBtn} onPress={autoFill} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#e51515" size="small" />
            : <Text style={styles.autoBtnText}>📍  Auto-Fill from My Location</Text>
          }
        </TouchableOpacity>
        {autoFilled && <Text style={styles.autoFilled}>✅ Weather data filled from your current location</Text>}

        <View style={styles.card}>
          <InputField fieldKey="elevation" label="Field Elevation (ft)" placeholder="e.g. 50" hint="Auto-filled from GPS, or enter manually" />
          <InputField fieldKey="temperature" label="Temperature (°F)" placeholder="e.g. 72" />
          <InputField fieldKey="pressure" label="Barometric Pressure (inHg)" placeholder="e.g. 29.92" hint="Auto-filled from weather, or check your phone" />
          <InputField fieldKey="humidity" label="Humidity % (optional)" placeholder="e.g. 45" isLast />
        </View>

        <TouchableOpacity style={styles.calcBtn} onPress={calculate}>
          <Text style={styles.calcBtnText}>CALCULATE</Text>
        </TouchableOpacity>

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Density Altitude</Text>
            <Text style={styles.resultValue}>{result.DA.toLocaleString()} ft</Text>
            <Text style={[styles.ratingText, { color: result.ratingColor }]}>{result.rating}</Text>
            <View style={styles.divider} />
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Pressure Alt</Text>
                <Text style={styles.statValue}>{result.PA.toLocaleString()} ft</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Est. Power Loss</Text>
                <Text style={styles.statValue}>~{result.powerLoss}%</Text>
              </View>
            </View>
            <TouchableOpacity onPress={reset} style={styles.resetBtn}>
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
  autoBtn: { borderWidth: 1, borderColor: '#e51515', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 8, minHeight: 48, justifyContent: 'center' },
  autoBtnText: { color: '#e51515', fontWeight: '700', fontSize: 14 },
  autoFilled: { color: '#4caf50', fontSize: 12, textAlign: 'center', marginBottom: 12 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 14 },
  label: { color: '#aaa', fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { color: '#555', fontSize: 11, marginBottom: 6 },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 8, color: '#fff', fontSize: 18, padding: 12, fontWeight: '700' },
  calcBtn: { backgroundColor: '#e51515', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 20 },
  calcBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 2 },
  resultCard: { backgroundColor: '#111', borderWidth: 1, borderColor: '#e51515', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 20 },
  resultLabel: { color: '#aaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  resultValue: { color: '#e51515', fontSize: 48, fontWeight: '800', marginVertical: 8 },
  ratingText: { fontSize: 15, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#222', width: '100%', marginVertical: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 16 },
  stat: { alignItems: 'center' },
  statLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  resetBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 8 },
  resetBtnText: { color: '#888', fontSize: 14 },
});
