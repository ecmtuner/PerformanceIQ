import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default function DensityAltitudeScreen() {
  const [elevation, setElevation] = useState('');
  const [temperature, setTemperature] = useState('');
  const [pressure, setPressure] = useState('');
  const [humidity, setHumidity] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    const elev = parseFloat(elevation) || 0;
    const tempF = parseFloat(temperature);
    const baro = parseFloat(pressure);
    const rh = parseFloat(humidity) || 0;
    if (isNaN(tempF) || isNaN(baro)) return;

    // Pressure altitude
    const PA = elev + (29.92 - baro) * 1000;

    // ISA standard temp at this elevation
    const ISA_temp = 59 - (elev / 1000) * 3.5;

    // Density altitude (basic)
    let DA = PA + 120 * (tempF - ISA_temp);

    // Humidity correction (optional, adds to DA)
    if (rh > 0) {
      const tempC = (tempF - 32) * 5 / 9;
      const Psat = 6.1078 * Math.pow(10, (7.5 * tempC) / (237.3 + tempC)); // hPa
      const Pv = (rh / 100) * Psat;
      DA += Pv * 100; // rough humidity correction in feet
    }

    const daRounded = Math.round(DA);
    let rating = '', ratingColor = '';
    if (DA < 1000) { rating = '🟢 Excellent conditions'; ratingColor = '#4caf50'; }
    else if (DA < 3000) { rating = '🟡 Good conditions'; ratingColor = '#ffeb3b'; }
    else if (DA < 5000) { rating = '🟠 Fair conditions'; ratingColor = '#ff9800'; }
    else { rating = '🔴 Poor conditions'; ratingColor = '#e51515'; }

    const powerLoss = ((DA / 1000) * 3).toFixed(1); // ~3% HP loss per 1000 ft DA

    setResult({ DA: daRounded, PA: Math.round(PA), rating, ratingColor, powerLoss });
  };

  const reset = () => { setElevation(''); setTemperature(''); setPressure(''); setHumidity(''); setResult(null); };

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
      <Text style={styles.title}>Density Altitude</Text>
      <Text style={styles.subtitle}>Racing Conditions</Text>

      <View style={styles.card}>
        <Field label="Field Elevation (ft)" value={elevation} onChange={setElevation} placeholder="e.g. 50  (sea level ≈ 0)" hint="Your track elevation above sea level" />
        <Field label="Temperature (°F)" value={temperature} onChange={setTemperature} placeholder="e.g. 72" />
        <Field label="Barometric Pressure (inHg)" value={pressure} onChange={setPressure} placeholder="e.g. 29.92" hint="Check your phone weather app" />
        <Field label="Humidity % (optional)" value={humidity} onChange={setHumidity} placeholder="e.g. 45" />
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
  resultValue: { color: '#e51515', fontSize: 48, fontWeight: '800', marginVertical: 8 },
  ratingText: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  divider: { height: 1, backgroundColor: '#222', width: '100%', marginVertical: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 16 },
  stat: { alignItems: 'center' },
  statLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  resetBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 8 },
  resetBtnText: { color: '#888', fontSize: 14 },
});
