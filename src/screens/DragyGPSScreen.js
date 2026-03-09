import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Clipboard } from 'react-native';
import { bleManager, requestBLEPermissions, DRAGY_PREFIX } from '../services/BLEManager';
import { atob, btoa } from 'react-native-quick-base64';
import { parseNMEASpeed, parseNMEAVTG, parseFixStatus, parseDragySentence, RunCalculator, splitNMEABuffer } from '../services/DragyGPSService';
import { setLastRun } from '../services/RunStore';

const STATES = { IDLE: 'idle', SCANNING: 'scanning', CONNECTING: 'connecting', CONNECTED: 'connected', RECORDING: 'recording', ERROR: 'error' };
const BRACKETS = [
  { label: '0–60 mph',    from: 0,   to: 60  },
  { label: '0–100 mph',   from: 0,   to: 100 },
  { label: '60–130 mph',  from: 60,  to: 130 },
  { label: '100–150 mph', from: 100, to: 150 },
  { label: '100–200 mph', from: 100, to: 200 },
];

// Dragy-specific UUIDs discovered from debug scan
const DRAGY_CMD_CHARS   = ['00001018', '0000fd01', '0000fd03']; // write = send start command
const DRAGY_DATA_CHARS  = ['0000fd04', '0000fd02', '00001014']; // notify = data comes out

const b64 = (bytes) => btoa(String.fromCharCode(...bytes));

// Start commands to try — targeting eHong BLE module + u-blox M8
const START_COMMANDS = [
  b64([0x01]),
  b64([0x02]),
  b64([0xA5, 0x01]),
  b64([0x00]),
  b64([0x0D, 0x0A]), // \r\n
  btoa('start\r\n'),
];

const decodeB64 = (b64str) => {
  try { return atob(b64str); }
  catch { return ''; }
};

export default function DragyGPSScreen() {
  const [state, setState] = useState(STATES.IDLE);
  const [devices, setDevices] = useState([]);
  const [connected, setConnected] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [peakSpeed, setPeakSpeed] = useState(0);
  const [times, setTimes] = useState({});
  const [bracket, setBracket] = useState(BRACKETS[2]);
  const [gpsStatus, setGpsStatus] = useState('—');
  const [rawLog, setRawLog] = useState(['Not connected yet.']);
  const [completedRun, setCompletedRun] = useState(null);
  const deviceRef = useRef(null);
  const calcRef = useRef(new RunCalculator());
  const bufferRef = useRef('');
  const logThrottleRef = useRef(0);
  const reconnectRef = useRef(false);
  const lastDeviceRef = useRef(null);
  const updateRef = useRef(null);

  useEffect(() => () => {
    clearInterval(updateRef.current);
    deviceRef.current?.cancelConnection();
    bleManager.stopDeviceScan();
  }, []);

  const addRaw = (msg) => setRawLog(l => [msg, ...l.slice(0, 40)]);

  const scan = async () => {
    const granted = await requestBLEPermissions();
    if (!granted) { Alert.alert('Permission Required', 'Bluetooth permission required.'); return; }
    setState(STATES.SCANNING); setDevices([]);
    addRaw('Scanning...');
    bleManager.startDeviceScan(null, { allowDuplicates: false }, (err, device) => {
      if (err) { setState(STATES.ERROR); addRaw(`Err: ${err.message}`); return; }
      if (device?.name?.startsWith(DRAGY_PREFIX)) {
        bleManager.stopDeviceScan(); setState(STATES.IDLE);
        setDevices([{ id: device.id, name: device.name }]);
        addRaw(`✅ Found: ${device.name}`);
      } else if (device?.name) {
        setDevices(d => d.find(x => x.id === device.id) ? d : [...d, { id: device.id, name: device.name }]);
      }
    });
    setTimeout(() => { bleManager.stopDeviceScan(); setState(p => p === STATES.SCANNING ? STATES.IDLE : p); }, 15000);
  };

  const connect = async (device) => {
    bleManager.stopDeviceScan(); setState(STATES.CONNECTING);
    addRaw(`Connecting to ${device.name}...`);
    try {
      const d = await bleManager.connectToDevice(device.id, { timeout: 15000 });
      await d.discoverAllServicesAndCharacteristics();
      deviceRef.current = d;
      lastDeviceRef.current = device;
      reconnectRef.current = true;
      bufferRef.current = '';  // clear stale buffer on (re)connect
      calcRef.current.reset(); // clear stale samples on (re)connect

      const services = await d.services();
      const allChars = [];
      for (const svc of services) {
        const chars = await svc.characteristics();
        chars.forEach(c => allChars.push(c));
      }

      addRaw(`Total chars: ${allChars.length}`);

      // 1. Subscribe to data characteristics explicitly by UUID
      let monitored = 0;
      const DATA_UUIDS = ['0000fd02', '0000fd04', '00001014'];
      for (const uuid of DATA_UUIDS) {
        const c = allChars.find(x => x.uuid.toLowerCase().includes(uuid));
        if (!c) { addRaw(`⚠️ ${uuid} not found`); continue; }
        if (!c.isNotifiable && !c.isIndicatable) { addRaw(`⚠️ ${uuid} not notifiable`); continue; }
        monitored++;
        addRaw(`📡 Subscribing: ${uuid.replace('0000','')}...`);
        c.monitor((err, char) => {
          if (err) {
            addRaw(`❌ BLE err [${uuid.replace('0000','')}]: ${err.message}`);
            // Auto-reconnect if unexpected disconnect
            if (reconnectRef.current && lastDeviceRef.current && err.message?.includes('disconnect')) {
              reconnectRef.current = false;
              addRaw('🔄 Reconnecting...');
              setTimeout(() => connect(lastDeviceRef.current), 2000);
            }
            return;
          }
          if (!char?.value) return;
          try {
            const raw = decodeB64(char.value);
            bufferRef.current += raw;
            const { sentences, remaining } = splitNMEABuffer(bufferRef.current);
            bufferRef.current = remaining;
            sentences.forEach(line => {
              processLine(line);
              // @ lines handled + incremented inside processLine
              if (!line.startsWith("@")) {
                if (logThrottleRef.current % 10 === 0) addRaw(line.substring(0, 60));
                logThrottleRef.current++;
              }
            });
          } catch (e) { addRaw(`❌ Parse err: ${e.message}`); }
        });
        addRaw(`✅ Subscribed: ${uuid.replace('0000','')}`);
      }

      // Dragy streams data automatically on subscription — NO write commands needed
      // Writing to fd01 was found to crash the BLE module and disconnect the device

      addRaw(`Monitoring ${monitored} chars. Waiting for data...`);
      setState(STATES.CONNECTED); setConnected(device.name);

      updateRef.current = setInterval(() => {
        const calc = calcRef.current;
        const raw = calc.getCurrentSpeed();
        setSpeed(parseFloat((raw < 0.5 ? 0 : raw).toFixed(1)));
        setPeakSpeed(parseFloat(calc.getPeakSpeed().toFixed(1)));
        if (bracket.from === 0) {
          const t = calc.getTimeAt(bracket.to);
          if (t) setTimes(prev => ({ ...prev, [bracket.label]: t }));
        } else {
          const t = calc.getRollTime(bracket.from, bracket.to);
          if (t) setTimes(prev => ({ ...prev, [bracket.label]: t }));
        }
      }, 100);
    } catch (e) {
      addRaw(`FAILED: ${e.message}`);
      Alert.alert('Connection Failed', e.message);
      setState(STATES.ERROR);
    }
  };

  const processLine = (line) => {
    // Dragy proprietary '@' sentence — primary data source
    if (line.startsWith('@')) {
      const parts = line.split(',');
      const dragy = parseDragySentence(line);
      if (dragy) {
        setGpsStatus(dragy.hasFix ? '✅ GPS Fix' : '⚠️ No Fix');
        const altM = parseFloat(parts[7]) || 0;
        calcRef.current.addSample(dragy.speedMph, isNaN(altM) ? 0 : altM);
        // Type A: ALWAYS log (high-freq speed sentence) — never throttle
        if (dragy.sentenceType === 'A') {
          addRaw(`🚀 TYPE-A p1:${parts[1]} → ${dragy.speedMph.toFixed(1)}mph`);
        } else if (logThrottleRef.current % 10 === 0) {
          // Type B: throttled, show all fields including p1
          addRaw(`p1:${parts[1]} fix:${parts[5]} sats:${parts[6]} alt:${parts[7]} → ${dragy.speedMph.toFixed(2)}mph`);
        }
      } else {
        // ALWAYS log parse failures
        addRaw(`❓ FAIL: ${line.substring(0,65)}`);
      }
      return;
    }
    // Fallback: standard NMEA (for other GPS devices)
    const fix = parseFixStatus(line);
    if (fix) setGpsStatus(fix === 'fix' ? '✅ GPS Fix' : '⚠️ No Fix');
    let spd = parseNMEASpeed(line, false);
    if (spd === null) spd = parseNMEAVTG(line);
    if (spd !== null) calcRef.current.addSample(spd);
  };

  const startRun = () => { calcRef.current.reset(); setTimes({}); setPeakSpeed(0); setState(STATES.RECORDING); };
  const stopRun = () => {
    // Capture BEFORE state change — ref stays valid here
    const snap = {
      samples: [...calcRef.current.samples],
      altSamples: [...(calcRef.current.altSamples || [])],
      satellites: 12,
    };
    if (snap.samples.length > 2) {
      setLastRun(snap.samples, snap.altSamples, snap.satellites);
      setCompletedRun(snap);
    }
    setState(STATES.CONNECTED);
  };
  const disconnect = () => {
    reconnectRef.current = false; lastDeviceRef.current = null;
    clearInterval(updateRef.current); deviceRef.current?.cancelConnection(); deviceRef.current = null;
    setState(STATES.IDLE); setConnected(null); setSpeed(0); setPeakSpeed(0); setTimes({});
    setGpsStatus('—'); setRawLog(['Disconnected.']);
  };

  const statusColor = { [STATES.CONNECTED]: '#4caf50', [STATES.RECORDING]: '#e51515', [STATES.SCANNING]: '#ffeb3b', [STATES.CONNECTING]: '#ff9800', [STATES.ERROR]: '#e51515', [STATES.IDLE]: '#555' };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Dragy GPS</Text>
      <Text style={styles.subtitle}>Performance Meter</Text>

      <View style={styles.statusBar}>
        <View style={[styles.statusDot, { backgroundColor: statusColor[state] }]} />
        <Text style={styles.statusText}>{connected || (state === STATES.SCANNING ? 'Scanning...' : state === STATES.CONNECTING ? 'Connecting...' : 'Not connected')}</Text>
        {connected && <TouchableOpacity onPress={disconnect} style={styles.disconnectBtn}><Text style={styles.disconnectText}>Disconnect</Text></TouchableOpacity>}
      </View>

      {!connected && <View style={styles.hintBox}><Text style={styles.hintText}>💡 Open Dragy app briefly to wake your GPS unit, then come back and tap Scan.</Text></View>}
      {!connected && (
        <TouchableOpacity style={styles.scanBtn} onPress={scan} disabled={state === STATES.SCANNING || state === STATES.CONNECTING}>
          <Text style={styles.scanBtnText}>{state === STATES.SCANNING ? '🔍 Scanning...' : '🔍 Scan for Dragy'}</Text>
        </TouchableOpacity>
      )}

      {devices.length > 0 && !connected && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Found Devices</Text>
          {devices.map(d => (
            <TouchableOpacity key={d.id} style={styles.deviceRow} onPress={() => connect(d)}>
              <Text style={styles.deviceName}>{d.name}</Text>
              <Text style={styles.connectTap}>Connect →</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {connected && (
        <>
          <View style={[styles.card, { paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between' }]}>
            <Text style={styles.fixStatus}>GPS: {gpsStatus}</Text>
          </View>

          <View style={styles.speedCard}>
            <Text style={styles.speedLabel}>SPEED</Text>
            <Text style={styles.speedValue}>{speed.toFixed(1)}</Text>
            <Text style={styles.speedUnit}>mph</Text>
            <Text style={styles.peakSpeed}>Peak: {peakSpeed.toFixed(1)} mph</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Measure Bracket</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.bracketRow}>
                {BRACKETS.map(b => (
                  <TouchableOpacity key={b.label} style={[styles.bracketBtn, bracket.label === b.label && styles.bracketBtnActive]} onPress={() => { setBracket(b); setTimes({}); }}>
                    <Text style={[styles.bracketBtnText, bracket.label === b.label && styles.bracketBtnTextActive]}>{b.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {state !== STATES.RECORDING
            ? <TouchableOpacity style={styles.recordBtn} onPress={startRun}><Text style={styles.recordBtnText}>⏺ START RUN</Text></TouchableOpacity>
            : <TouchableOpacity style={[styles.recordBtn, styles.stopBtn]} onPress={stopRun}><Text style={styles.recordBtnText}>⏹ STOP RUN</Text></TouchableOpacity>}
          {completedRun && completedRun.samples.length > 2 && (
            <TouchableOpacity style={styles.resultsBtn} onPress={() => navigation?.navigate('DragyResults', {})}>
              <Text style={styles.resultsBtnText}>📊 View Results</Text>
            </TouchableOpacity>
          )}

          {Object.keys(times).length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Results</Text>
              {Object.entries(times).map(([label, t]) => (
                <View key={label} style={styles.timeRow}>
                  <Text style={styles.timeLabel}>{label}</Text>
                  <Text style={styles.timeValue}>{t}s</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <View style={styles.debugCard}>
        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
          <Text style={styles.sectionTitle}>📡 Debug Log</Text>
          <TouchableOpacity onPress={() => { Clipboard.setString(rawLog.join('\n')); Alert.alert('Copied', 'Debug log copied to clipboard'); }} style={styles.copyBtn}>
            <Text style={styles.copyBtnText}>📋 Copy</Text>
          </TouchableOpacity>
        </View>
        {rawLog.map((l, i) => <Text key={i} style={[styles.rawLine, l.includes('NMEA') && styles.nmea, l.includes('✅') && styles.good]}>{l}</Text>)}
      </View>
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  title: { color: '#e51515', fontSize: 28, fontWeight: '800', marginTop: 12 },
  subtitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 16 },
  statusBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, marginBottom: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { color: '#fff', fontWeight: '600', flex: 1 },
  disconnectBtn: { borderWidth: 1, borderColor: '#e51515', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  disconnectText: { color: '#e51515', fontSize: 12, fontWeight: '600' },
  hintBox: { backgroundColor: '#111', borderRadius: 10, padding: 12, marginBottom: 12 },
  hintText: { color: '#888', fontSize: 13, lineHeight: 18 },
  scanBtn: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#e51515', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 14 },
  scanBtnText: { color: '#e51515', fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 14 },
  sectionTitle: { color: '#aaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  fixStatus: { color: '#fff', fontWeight: '700', fontSize: 14 },
  deviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  deviceName: { color: '#fff', fontWeight: '700' },
  connectTap: { color: '#e51515', fontSize: 12 },
  speedCard: { backgroundColor: '#111', borderWidth: 1, borderColor: '#e51515', borderRadius: 14, padding: 24, alignItems: 'center', marginBottom: 14 },
  speedLabel: { color: '#555', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 2 },
  speedValue: { color: '#e51515', fontSize: 80, fontWeight: '900', lineHeight: 90 },
  speedUnit: { color: '#888', fontSize: 18, fontWeight: '600' },
  peakSpeed: { color: '#555', fontSize: 13, marginTop: 8 },
  bracketRow: { flexDirection: 'row', gap: 8 },
  bracketBtn: { borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  bracketBtnActive: { borderColor: '#e51515', backgroundColor: '#1e0000' },
  bracketBtnText: { color: '#888', fontSize: 13, fontWeight: '600' },
  bracketBtnTextActive: { color: '#e51515' },
  recordBtn: { backgroundColor: '#e51515', borderRadius: 10, padding: 18, alignItems: 'center', marginBottom: 14 },
  resultsBtn: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#e51515', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 14 },
  resultsBtnText: { color: '#e51515', fontWeight: '700', fontSize: 15 },
  stopBtn: { backgroundColor: '#333' },
  recordBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 2 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#111' },
  timeLabel: { color: '#ccc', fontSize: 14 },
  timeValue: { color: '#e51515', fontSize: 20, fontWeight: '800' },
  debugCard: { backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: '#222', borderRadius: 12, padding: 14, marginTop: 8 },
  copyBtn: { borderWidth: 1, borderColor: '#444', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  copyBtnText: { color: '#888', fontSize: 11, fontWeight: '600' },
  rawLine: { color: '#4a4a4a', fontSize: 10, fontFamily: 'monospace', marginBottom: 3 },
  nmea: { color: '#2a6a2a' },
  good: { color: '#4caf50' },
});
