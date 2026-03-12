import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { bleManager, requestBLEPermissions } from '../services/BLEManager';
import { atob } from 'react-native-quick-base64';

// Nordic UART Service — used by most BLE ethanol analyzers (Zeitronix, Continental adapters, DIY units)
const NORDIC_UART_SERVICE   = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NORDIC_UART_TX        = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // notify (sensor → phone)

// Parse ethanol data from common formats:
//   "E:45.2,T:21.5"   "45.2 21.5"   "eth=45.2,temp=21.5"   "45.2"   "45"
const parseEthanolData = (raw) => {
  const clean = raw.trim();
  const ethMatch =
    clean.match(/(?:E:|eth(?:anol)?[=:\s])\s*(\d+\.?\d*)/i) ||
    clean.match(/^(\d{1,3}\.?\d*)(?:\s|,|$)/);
  const tempMatch =
    clean.match(/(?:T:|temp(?:erature)?[=:\s])\s*(-?\d+\.?\d*)/i) ||
    clean.match(/(?:\s|,)(-?\d{1,3}\.?\d*)(?:\s|,|$)/);

  const ethanol = ethMatch  ? parseFloat(ethMatch[1])  : null;
  const temp    = tempMatch ? parseFloat(tempMatch[1]) : null;

  if (ethanol !== null && ethanol >= 0 && ethanol <= 100) return { ethanol, temp };
  return null;
};

const SENSOR_STATES = { IDLE: 'idle', SCANNING: 'scanning', CONNECTING: 'connecting', CONNECTED: 'connected', ERROR: 'error' };

export default function EthanolCalculatorScreen() {
  // ─── Sensor state ───────────────────────────────────────────────────────────
  const [sensorState, setSensorState]       = useState(SENSOR_STATES.IDLE);
  const [sensorDevices, setSensorDevices]   = useState([]);
  const [sensorName, setSensorName]         = useState(null);
  const [liveEthanol, setLiveEthanol]       = useState(null);
  const [liveTempC, setLiveTempC]           = useState(null);
  const [sensorLog, setSensorLog]           = useState([]);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const bleDeviceRef                        = useRef(null);
  const bufferRef                           = useRef('');

  useEffect(() => () => { disconnectSensor(true); }, []);

  const addSensorLog = (msg) => setSensorLog(l => [`${new Date().toLocaleTimeString()}: ${msg}`, ...l.slice(0, 20)]);

  const scanSensor = async () => {
    const granted = await requestBLEPermissions();
    if (!granted) { Alert.alert('Permission Required', 'Bluetooth permission is required.'); return; }
    setSensorState(SENSOR_STATES.SCANNING);
    setSensorDevices([]);
    setShowDeviceList(true);
    addSensorLog('Scanning for ethanol sensors...');
    bleManager.startDeviceScan(null, { allowDuplicates: false }, (err, device) => {
      if (err) { addSensorLog(`Scan error: ${err.message}`); setSensorState(SENSOR_STATES.ERROR); return; }
      if (device?.name) {
        setSensorDevices(d => d.find(x => x.id === device.id) ? d : [...d, { id: device.id, name: device.name, rssi: device.rssi }]);
      }
    });
    setTimeout(() => {
      bleManager.stopDeviceScan();
      setSensorState(SENSOR_STATES.IDLE);
      addSensorLog('Scan complete');
    }, 10000);
  };

  const connectSensor = async (device) => {
    bleManager.stopDeviceScan();
    setSensorState(SENSOR_STATES.CONNECTING);
    setShowDeviceList(false);
    addSensorLog(`Connecting to ${device.name}...`);
    try {
      const d = await bleManager.connectToDevice(device.id, { timeout: 10000 });
      await d.discoverAllServicesAndCharacteristics();
      bleDeviceRef.current = d;

      // Try Nordic UART TX characteristic first, fallback to first notifiable
      let notifyChar = null;
      try {
        const chars = await d.characteristicsForService(NORDIC_UART_SERVICE);
        notifyChar = chars.find(c => c.uuid.toLowerCase() === NORDIC_UART_TX && (c.isNotifiable || c.isIndicatable));
      } catch (_) {}

      if (!notifyChar) {
        const services = await d.services();
        for (const svc of services) {
          const chars = await svc.characteristics();
          notifyChar = chars.find(c => c.isNotifiable || c.isIndicatable);
          if (notifyChar) break;
        }
      }

      if (!notifyChar) throw new Error('No notification characteristic found — device may not be supported');

      notifyChar.monitor((err, char) => {
        if (err || !char?.value) return;
        const chunk = atob(char.value);
        bufferRef.current += chunk;
        const lines = bufferRef.current.split(/[\r\n]+/);
        bufferRef.current = lines.pop() ?? '';
        lines.forEach(line => {
          if (!line.trim()) return;
          const parsed = parseEthanolData(line.trim());
          if (parsed) {
            setLiveEthanol(parsed.ethanol.toFixed(1));
            if (parsed.temp !== null) setLiveTempC(parsed.temp.toFixed(1));
            addSensorLog(`E:${parsed.ethanol.toFixed(1)}%${parsed.temp !== null ? `  T:${parsed.temp.toFixed(1)}°C` : ''}`);
          }
        });
      });

      setSensorState(SENSOR_STATES.CONNECTED);
      setSensorName(device.name);
      addSensorLog(`Connected to ${device.name}`);
    } catch (e) {
      addSensorLog(`Connection failed: ${e.message}`);
      setSensorState(SENSOR_STATES.ERROR);
    }
  };

  const disconnectSensor = (silent = false) => {
    bleManager.stopDeviceScan();
    bleDeviceRef.current?.cancelConnection?.();
    bleDeviceRef.current = null;
    setSensorState(SENSOR_STATES.IDLE);
    setSensorName(null);
    setLiveEthanol(null);
    setLiveTempC(null);
    bufferRef.current = '';
    if (!silent) addSensorLog('Disconnected.');
  };

  const tempF = liveTempC !== null ? ((parseFloat(liveTempC) * 9 / 5) + 32).toFixed(1) : null;

  // ─── Calculator state ────────────────────────────────────────────────────────
  const [tankSize, setTankSize]           = useState('');
  const [currentLevel, setCurrentLevel]   = useState('');
  const [currentEthanol, setCurrentEthanol] = useState('');
  const [targetEthanol, setTargetEthanol] = useState('');
  const [result, setResult]               = useState(null);

  const useReading = () => {
    if (liveEthanol !== null) {
      setCurrentEthanol(liveEthanol);
      setResult(null);
    }
  };

  const calculate = () => {
    const tank  = parseFloat(tankSize);
    const level = parseFloat(currentLevel);
    const currE = parseFloat(currentEthanol) / 100;
    const targE = parseFloat(targetEthanol) / 100;
    const E85   = 0.85;

    if ([tank, level, currE, targE].some(isNaN)) return;
    if (level > tank) return;
    if (targE <= currE) { setResult({ error: 'Target must be higher than current ethanol %' }); return; }

    const currentEthanolGal = level * currE;
    const gallonsToAdd = (targE * level - currentEthanolGal) / (E85 - targE);

    if (gallonsToAdd < 0 || gallonsToAdd + level > tank) {
      setResult({ error: 'Cannot reach target with current tank space. Burn some fuel first.' });
      return;
    }

    const finalVolume      = level + gallonsToAdd;
    const finalEthanolGal  = currentEthanolGal + gallonsToAdd * E85;
    const finalEthanolPct  = (finalEthanolGal / finalVolume) * 100;
    const octane           = 87 + (finalEthanolPct / 85) * (105 - 87);

    setResult({
      gallonsToAdd:    gallonsToAdd.toFixed(2),
      finalEthanolPct: finalEthanolPct.toFixed(1),
      finalVolume:     finalVolume.toFixed(2),
      octane:          Math.min(octane, 105).toFixed(1),
    });
  };

  const reset = () => {
    setTankSize(''); setCurrentLevel(''); setCurrentEthanol(''); setTargetEthanol(''); setResult(null);
  };

  const Field = ({ label, value, onChange, placeholder, hint, highlight }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <TextInput
        style={[styles.input, highlight && styles.inputHighlight]}
        value={value}
        onChangeText={(v) => { onChange(v); setResult(null); }}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor="#555"
      />
    </View>
  );

  const dotColor = {
    [SENSOR_STATES.CONNECTED]:  '#4caf50',
    [SENSOR_STATES.SCANNING]:   '#ffeb3b',
    [SENSOR_STATES.CONNECTING]: '#ff9800',
    [SENSOR_STATES.ERROR]:      '#e51515',
    [SENSOR_STATES.IDLE]:       '#555',
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
      <Text style={styles.title}>Ethanol</Text>
      <Text style={styles.subtitle}>Analyzer + Mix Calculator</Text>

      {/* ─── BLE ETHANOL SENSOR ─────────────────────────────────────────────── */}
      <View style={styles.sensorCard}>
        <View style={styles.sensorHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>📡 Ethanol Content Analyzer</Text>
            <Text style={styles.sensorHint}>Continental / Zeitronix / BLE ethanol sensors</Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: dotColor[sensorState] }]} />
        </View>

        {/* Live reading — shown when connected */}
        {sensorState === SENSOR_STATES.CONNECTED && (
          <View style={styles.liveCard}>
            <View style={styles.liveRow}>
              <View style={styles.liveBlock}>
                <Text style={styles.liveValue}>{liveEthanol ?? '--'}<Text style={styles.liveUnit}>%</Text></Text>
                <Text style={styles.liveLabel}>ETHANOL</Text>
              </View>
              {tempF !== null && (
                <View style={styles.liveBlock}>
                  <Text style={styles.liveValueAlt}>{tempF}<Text style={styles.liveUnit}>°F</Text></Text>
                  <Text style={styles.liveLabel}>FUEL TEMP</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.useBtn} onPress={useReading} disabled={liveEthanol === null}>
              <Text style={styles.useBtnText}>⬇ Use This Reading in Calculator</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sensor status bar */}
        <View style={styles.sensorStatusRow}>
          <Text style={styles.sensorStatusText}>
            {sensorState === SENSOR_STATES.CONNECTED  ? `Connected: ${sensorName}` :
             sensorState === SENSOR_STATES.CONNECTING ? 'Connecting...' :
             sensorState === SENSOR_STATES.SCANNING   ? 'Scanning...' :
             sensorState === SENSOR_STATES.ERROR      ? 'Connection failed' : 'Not connected'}
          </Text>
          {sensorState === SENSOR_STATES.CONNECTED
            ? <TouchableOpacity onPress={() => disconnectSensor(false)} style={styles.disconnectBtn}>
                <Text style={styles.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            : <TouchableOpacity
                onPress={scanSensor}
                disabled={sensorState === SENSOR_STATES.SCANNING || sensorState === SENSOR_STATES.CONNECTING}
                style={[styles.connectBtn, (sensorState === SENSOR_STATES.SCANNING || sensorState === SENSOR_STATES.CONNECTING) && styles.connectBtnDisabled]}>
                <Text style={styles.connectBtnText}>
                  {sensorState === SENSOR_STATES.SCANNING ? 'Scanning...' : '📡 Scan for Sensor'}
                </Text>
              </TouchableOpacity>
          }
        </View>

        {/* Device list */}
        {showDeviceList && sensorDevices.length > 0 && sensorState !== SENSOR_STATES.CONNECTED && (
          <View style={{ marginTop: 10 }}>
            {sensorDevices.map(d => (
              <TouchableOpacity key={d.id} style={styles.deviceRow} onPress={() => connectSensor(d)}>
                <View>
                  <Text style={styles.deviceName}>{d.name}</Text>
                  <Text style={styles.deviceId}>{d.id}</Text>
                </View>
                <Text style={styles.connectTap}>Tap to connect →</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Sensor log */}
        {sensorLog.length > 0 && (
          <View style={{ marginTop: 10 }}>
            {sensorLog.slice(0, 5).map((l, i) => (
              <Text key={i} style={styles.logLine}>{l}</Text>
            ))}
          </View>
        )}
      </View>

      {/* ─── MIX CALCULATOR ─────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Field label="Tank Size (gallons)"           value={tankSize}        onChange={setTankSize}        placeholder="e.g. 16.0" />
        <Field label="Current Fuel Level (gallons)"  value={currentLevel}    onChange={setCurrentLevel}    placeholder="e.g. 8.0" hint="How much fuel is in the tank right now" />
        <Field
          label="Current Ethanol %"
          value={currentEthanol}
          onChange={setCurrentEthanol}
          placeholder="e.g. 10  (E10 pump gas)"
          highlight={liveEthanol !== null && currentEthanol === liveEthanol}
          hint={liveEthanol !== null ? `📡 Live sensor: ${liveEthanol}% — tap "Use This Reading" above` : null}
        />
        <Field label="Target Ethanol %"              value={targetEthanol}   onChange={setTargetEthanol}   placeholder="e.g. 40  (E40 blend)" />
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
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  title:             { color: '#e51515', fontSize: 28, fontWeight: '800', marginTop: 12 },
  subtitle:          { color: '#ffffff', fontSize: 18, fontWeight: '600', marginBottom: 20 },

  // Sensor card
  sensorCard:        { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  sensorHeader:      { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle:      { color: '#aaa', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  sensorHint:        { color: '#444', fontSize: 11, marginTop: 2 },
  statusDot:         { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },

  liveCard:          { backgroundColor: '#0d1a0d', borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#1a4a1a' },
  liveRow:           { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  liveBlock:         { alignItems: 'center' },
  liveValue:         { color: '#4caf50', fontSize: 52, fontWeight: '800' },
  liveValueAlt:      { color: '#81c784', fontSize: 36, fontWeight: '700' },
  liveUnit:          { fontSize: 16, fontWeight: '400', color: '#888' },
  liveLabel:         { color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  useBtn:            { backgroundColor: '#1b3a1b', borderWidth: 1, borderColor: '#4caf50', borderRadius: 8, padding: 10, alignItems: 'center' },
  useBtnText:        { color: '#4caf50', fontWeight: '700', fontSize: 13 },

  sensorStatusRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sensorStatusText:  { color: '#666', fontSize: 12, flex: 1 },
  connectBtn:        { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#e51515', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  connectBtnDisabled:{ borderColor: '#333', opacity: 0.5 },
  connectBtnText:    { color: '#e51515', fontWeight: '700', fontSize: 12 },
  disconnectBtn:     { borderWidth: 1, borderColor: '#555', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  disconnectText:    { color: '#888', fontSize: 12, fontWeight: '600' },

  deviceRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#222' },
  deviceName:        { color: '#fff', fontWeight: '700', fontSize: 13 },
  deviceId:          { color: '#444', fontSize: 11 },
  connectTap:        { color: '#e51515', fontSize: 12 },
  logLine:           { color: '#444', fontSize: 11, marginTop: 2 },

  // Calculator
  card:              { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 14 },
  label:             { color: '#aaa', fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  hint:              { color: '#555', fontSize: 11, marginBottom: 6 },
  input:             { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 8, color: '#fff', fontSize: 18, padding: 12, fontWeight: '700' },
  inputHighlight:    { borderColor: '#4caf50' },
  calcBtn:           { backgroundColor: '#e51515', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 20 },
  calcBtnText:       { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 2 },

  resultCard:        { backgroundColor: '#111', borderWidth: 1, borderColor: '#e51515', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 40 },
  errorCard:         { borderColor: '#aa4400' },
  errorText:         { color: '#ff6633', fontSize: 15, textAlign: 'center' },
  resultLabel:       { color: '#aaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  resultValue:       { color: '#e51515', fontSize: 52, fontWeight: '800', marginVertical: 8 },
  divider:           { height: 1, backgroundColor: '#222', width: '100%', marginVertical: 12 },
  statsRow:          { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 16 },
  stat:              { alignItems: 'center' },
  statLabel:         { color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  statValue:         { color: '#fff', fontSize: 20, fontWeight: '700' },
  resetBtn:          { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 8 },
  resetBtnText:      { color: '#888', fontSize: 14 },
});