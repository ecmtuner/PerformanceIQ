import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { bleManager, requestBLEPermissions } from '../services/BLEManager';
import { PIDS, parseOBD2Response, AT_COMMANDS } from '../services/OBD2Service';
import { atob, btoa } from 'react-native-quick-base64';
import RNBluetoothClassic from 'react-native-bluetooth-classic';

const LIVE_PIDS = [PIDS.RPM, PIDS.SPEED, PIDS.THROTTLE, PIDS.COOLANT_TEMP, PIDS.INTAKE_TEMP, PIDS.MAP, PIDS.SHORT_FUEL, PIDS.LONG_FUEL, PIDS.TIMING_ADV, PIDS.BATTERY];
const STATES = { IDLE: 'idle', SCANNING: 'scanning', CONNECTING: 'connecting', INITIALIZING: 'initializing', CONNECTED: 'connected', ERROR: 'error' };

export default function OBD2Screen() {
  const [transport, setTransport] = useState('classic'); // 'classic' | 'ble'
  const [state, setState] = useState(STATES.IDLE);
  const [devices, setDevices] = useState([]);
  const [connected, setConnected] = useState(null);
  const [liveData, setLiveData] = useState({});
  const [log, setLog] = useState([]);
  const [dtcs, setDtcs] = useState([]);

  // Refs that work for both transports
  const classicDeviceRef = useRef(null);  // BluetoothClassic device
  const bleDeviceRef = useRef(null);      // BLE device
  const bleCharRef = useRef(null);        // BLE write characteristic
  const pollingRef = useRef(null);
  const bufferRef = useRef('');
  const classicSubRef = useRef(null);     // Classic data subscription
  const pidIndexRef = useRef(0);

  useEffect(() => () => { cleanup(); }, []);

  const cleanup = () => {
    clearInterval(pollingRef.current);
    classicSubRef.current?.remove();
    classicDeviceRef.current?.disconnect?.();
    bleDeviceRef.current?.cancelConnection?.();
    bleManager.stopDeviceScan();
  };

  const addLog = (msg) => setLog(l => [`${new Date().toLocaleTimeString()}: ${msg}`, ...l.slice(0, 50)]);

  // ─── CLASSIC BLUETOOTH ───────────────────────────────────────────────────────
  const loadPairedDevices = async () => {
    try {
      setState(STATES.SCANNING);
      const paired = await RNBluetoothClassic.getBondedDevices();
      setDevices(paired.map(d => ({ id: d.address, name: d.name || d.address, classic: true })));
      setState(STATES.IDLE);
      addLog(`Found ${paired.length} paired device(s)`);
    } catch (e) {
      addLog(`Classic BT error: ${e.message}`);
      setState(STATES.ERROR);
    }
  };

  const connectClassic = async (device) => {
    setState(STATES.CONNECTING);
    addLog(`Connecting to ${device.name}...`);
    try {
      const dev = await RNBluetoothClassic.connectToDevice(device.id);
      classicDeviceRef.current = dev;

      // Listen for incoming data
      classicSubRef.current = RNBluetoothClassic.onDeviceRead(device.id, (event) => {
        bufferRef.current += event.data || '';
        const lines = bufferRef.current.split('\r');
        bufferRef.current = lines.pop();
        lines.forEach(line => { if (line.trim()) processResponse(line.trim()); });
      });

      setState(STATES.INITIALIZING);
      addLog('Connected! Initializing ELM327...');
      await initELM327Classic();
    } catch (e) {
      addLog(`Connection failed: ${e.message}`);
      setState(STATES.ERROR);
    }
  };

  const initELM327Classic = async () => {
    bufferRef.current = '';
    for (const cmd of Object.values(AT_COMMANDS)) {
      await writeClassic(cmd);
      await delay(300);
    }
    setState(STATES.CONNECTED);
    setConnected(classicDeviceRef.current?.name || 'Classic Device');
    addLog('ELM327 initialized. Live data active.');
    startPolling();
  };

  const writeClassic = async (cmd) => {
    try {
      await classicDeviceRef.current?.write(cmd);
    } catch (e) { addLog(`Write error: ${e.message}`); }
  };

  // ─── BLE BLUETOOTH ───────────────────────────────────────────────────────────
  const scanBLE = async () => {
    const granted = await requestBLEPermissions();
    if (!granted) { Alert.alert('Permission Required', 'Bluetooth permission is required.'); return; }

    setState(STATES.SCANNING);
    setDevices([]);
    addLog('Scanning for BLE OBD2 devices...');

    bleManager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) { addLog(`Scan error: ${error.message}`); setState(STATES.ERROR); return; }
      if (device?.name) {
        setDevices(d => d.find(x => x.id === device.id) ? d : [...d, { id: device.id, name: device.name, rssi: device.rssi, classic: false }]);
      }
    });

    setTimeout(() => {
      bleManager.stopDeviceScan();
      setState(STATES.IDLE);
      addLog('Scan complete');
    }, 10000);
  };

  const connectBLE = async (device) => {
    bleManager.stopDeviceScan();
    setState(STATES.CONNECTING);
    addLog(`Connecting to ${device.name}...`);
    try {
      const d = await bleManager.connectToDevice(device.id, { timeout: 10000 });
      await d.discoverAllServicesAndCharacteristics();
      bleDeviceRef.current = d;

      const services = await d.services();
      let writeChar = null, notifyChar = null;
      for (const svc of services) {
        const chars = await svc.characteristics();
        for (const c of chars) {
          if ((c.isWritableWithResponse || c.isWritableWithoutResponse) && !writeChar) writeChar = c;
          if ((c.isNotifiable || c.isIndicatable) && !notifyChar) notifyChar = c;
        }
      }
      if (!writeChar) throw new Error('No writable characteristic found');
      bleCharRef.current = writeChar;

      if (notifyChar) {
        notifyChar.monitor((err, char) => {
          if (err || !char?.value) return;
          bufferRef.current += atob(char.value);
          const lines = bufferRef.current.split('\r');
          bufferRef.current = lines.pop();
          lines.forEach(line => { if (line.trim()) processResponse(line.trim()); });
        });
      }

      setState(STATES.INITIALIZING);
      addLog('Connected! Initializing ELM327...');
      await initELM327BLE();
    } catch (e) {
      addLog(`Connection failed: ${e.message}`);
      setState(STATES.ERROR);
    }
  };

  const initELM327BLE = async () => {
    bufferRef.current = '';
    for (const cmd of Object.values(AT_COMMANDS)) {
      await writeBLE(cmd);
      await delay(300);
    }
    setState(STATES.CONNECTED);
    setConnected(bleDeviceRef.current?.name || 'BLE Device');
    addLog('ELM327 initialized. Live data active.');
    startPolling();
  };

  const writeBLE = async (cmd) => {
    try {
      await bleCharRef.current?.writeWithResponse(btoa(cmd));
    } catch (e) { addLog(`Write error: ${e.message}`); }
  };

  // ─── SHARED ──────────────────────────────────────────────────────────────────
  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  const sendCommand = (cmd) => transport === 'classic' ? writeClassic(cmd) : writeBLE(cmd);

  const startPolling = () => {
    pidIndexRef.current = 0;
    pollingRef.current = setInterval(async () => {
      const pid = LIVE_PIDS[pidIndexRef.current % LIVE_PIDS.length];
      pidIndexRef.current++;
      await sendCommand(pid.cmd);
    }, 200);
  };

  const processResponse = (line) => {
    for (const pid of LIVE_PIDS) {
      const val = parseOBD2Response(line, pid);
      if (val !== null) {
        setLiveData(d => ({ ...d, [pid.name]: { value: val, unit: pid.unit } }));
        return;
      }
    }
  };

  const readDTCs = async () => { addLog('Reading fault codes...'); await sendCommand('03\r'); };

  const clearDTCs = () => {
    Alert.alert('Clear Fault Codes', 'This will clear all stored DTCs. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => { await sendCommand('04\r'); addLog('DTCs cleared.'); setDtcs([]); } },
    ]);
  };

  const disconnect = () => {
    cleanup();
    classicDeviceRef.current = null; bleDeviceRef.current = null; bleCharRef.current = null;
    setState(STATES.IDLE); setConnected(null); setLiveData({}); setDevices([]);
    bufferRef.current = '';
    addLog('Disconnected.');
  };

  const handleScan = () => transport === 'classic' ? loadPairedDevices() : scanBLE();
  const handleConnect = (device) => transport === 'classic' ? connectClassic(device) : connectBLE(device);

  const statusColor = { [STATES.CONNECTED]: '#4caf50', [STATES.SCANNING]: '#ffeb3b', [STATES.CONNECTING]: '#ff9800', [STATES.INITIALIZING]: '#ff9800', [STATES.ERROR]: '#e51515', [STATES.IDLE]: '#555' };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>OBD2</Text>
      <Text style={styles.subtitle}>Live Vehicle Data</Text>

      {/* Transport selector */}
      {!connected && (
        <View style={styles.transportRow}>
          <TouchableOpacity
            style={[styles.transportBtn, transport === 'classic' && styles.transportActive]}
            onPress={() => { setTransport('classic'); setDevices([]); }}>
            <Text style={[styles.transportText, transport === 'classic' && styles.transportTextActive]}>🔵 Classic BT</Text>
            <Text style={styles.transportHint}>OBDLink MX+, paired devices</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.transportBtn, transport === 'ble' && styles.transportActive]}
            onPress={() => { setTransport('ble'); setDevices([]); }}>
            <Text style={[styles.transportText, transport === 'ble' && styles.transportTextActive]}>📡 BLE</Text>
            <Text style={styles.transportHint}>OBDLink CX, Vgate iCar Pro</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Status */}
      <View style={styles.statusBar}>
        <View style={[styles.statusDot, { backgroundColor: statusColor[state] || '#555' }]} />
        <Text style={styles.statusText}>{connected ? `Connected: ${connected}` : state.toUpperCase()}</Text>
        {connected && <TouchableOpacity onPress={disconnect} style={styles.disconnectBtn}><Text style={styles.disconnectText}>Disconnect</Text></TouchableOpacity>}
      </View>

      {/* Scan / Load button */}
      {!connected && (
        <TouchableOpacity
          style={[styles.scanBtn, (state === STATES.SCANNING || state === STATES.CONNECTING) && styles.scanBtnDisabled]}
          onPress={handleScan}
          disabled={state === STATES.SCANNING || state === STATES.CONNECTING || state === STATES.INITIALIZING}>
          <Text style={styles.scanBtnText}>
            {state === STATES.SCANNING
              ? (transport === 'classic' ? '🔵 Loading paired...' : '📡 Scanning BLE...')
              : (transport === 'classic' ? '🔵 Load Paired Devices' : '📡 Scan for BLE Devices')}
          </Text>
        </TouchableOpacity>
      )}

      {/* Classic hint */}
      {transport === 'classic' && !connected && devices.length === 0 && state === STATES.IDLE && (
        <View style={styles.hintBox}>
          <Text style={styles.hintText}>💡 Pair your OBDLink MX+ in Android Settings → Bluetooth first, then tap Load Paired Devices.</Text>
        </View>
      )}

      {/* Device list */}
      {devices.length > 0 && !connected && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{transport === 'classic' ? 'Paired Devices' : 'Found BLE Devices'}</Text>
          {devices.map(d => (
            <TouchableOpacity key={d.id} style={styles.deviceRow} onPress={() => handleConnect(d)}>
              <View>
                <Text style={styles.deviceName}>{d.name}</Text>
                <Text style={styles.deviceId}>{d.id}</Text>
              </View>
              <Text style={styles.connectTap}>Tap to connect →</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Live data grid */}
      {connected && Object.keys(liveData).length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Live Data</Text>
          <View style={styles.dataGrid}>
            {Object.entries(liveData).map(([name, { value, unit }]) => (
              <View key={name} style={styles.dataCell}>
                <Text style={styles.dataValue}>{value}<Text style={styles.dataUnit}> {unit}</Text></Text>
                <Text style={styles.dataName}>{name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* DTC */}
      {connected && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Fault Codes (DTC)</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.dtcBtn} onPress={readDTCs}><Text style={styles.dtcBtnText}>📋 Read Codes</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.dtcBtn, styles.dtcClearBtn]} onPress={clearDTCs}><Text style={styles.dtcClearText}>🗑️ Clear Codes</Text></TouchableOpacity>
          </View>
          {dtcs.length === 0 && <Text style={styles.noDtc}>No fault codes stored</Text>}
        </View>
      )}

      {/* Log */}
      {log.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Log</Text>
          {log.slice(0, 8).map((l, i) => <Text key={i} style={styles.logLine}>{l}</Text>)}
        </View>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  title: { color: '#e51515', fontSize: 28, fontWeight: '800', marginTop: 12 },
  subtitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 16 },
  transportRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  transportBtn: { flex: 1, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333', borderRadius: 10, padding: 12, alignItems: 'center' },
  transportActive: { borderColor: '#e51515', backgroundColor: '#1e0000' },
  transportText: { color: '#888', fontWeight: '700', fontSize: 14 },
  transportTextActive: { color: '#e51515' },
  transportHint: { color: '#444', fontSize: 10, marginTop: 3, textAlign: 'center' },
  statusBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, marginBottom: 14 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { color: '#fff', fontWeight: '600', flex: 1 },
  disconnectBtn: { borderWidth: 1, borderColor: '#e51515', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  disconnectText: { color: '#e51515', fontSize: 12, fontWeight: '600' },
  scanBtn: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#e51515', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 14 },
  scanBtnDisabled: { borderColor: '#333', opacity: 0.5 },
  scanBtnText: { color: '#e51515', fontWeight: '700', fontSize: 15 },
  hintBox: { backgroundColor: '#111', borderRadius: 10, padding: 12, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: '#e51515' },
  hintText: { color: '#888', fontSize: 13, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 14 },
  sectionTitle: { color: '#aaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  deviceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  deviceName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  deviceId: { color: '#555', fontSize: 11 },
  connectTap: { color: '#e51515', fontSize: 12 },
  dataGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dataCell: { backgroundColor: '#111', borderRadius: 8, padding: 12, width: '47%', alignItems: 'center' },
  dataValue: { color: '#e51515', fontSize: 24, fontWeight: '800' },
  dataUnit: { color: '#888', fontSize: 12, fontWeight: '400' },
  dataName: { color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  dtcBtn: { flex: 1, backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 12, alignItems: 'center' },
  dtcBtnText: { color: '#fff', fontWeight: '600' },
  dtcClearBtn: { borderColor: '#e51515' },
  dtcClearText: { color: '#e51515', fontWeight: '600' },
  noDtc: { color: '#4caf50', textAlign: 'center', marginTop: 8, fontSize: 13 },
  logLine: { color: '#444', fontSize: 11, marginBottom: 2 },
});
