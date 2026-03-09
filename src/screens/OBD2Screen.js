import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList, Alert, Platform } from 'react-native';
import { bleManager, requestBLEPermissions, OBD2_SERVICES, OBD2_CHARACTERISTICS } from '../services/BLEManager';
import { PIDS, parseOBD2Response, AT_COMMANDS } from '../services/OBD2Service';
import { atob, btoa } from 'react-native-quick-base64';

const LIVE_PIDS = [PIDS.RPM, PIDS.SPEED, PIDS.THROTTLE, PIDS.COOLANT_TEMP, PIDS.INTAKE_TEMP, PIDS.MAP, PIDS.SHORT_FUEL, PIDS.LONG_FUEL, PIDS.TIMING_ADV, PIDS.BATTERY];

const STATES = { IDLE: 'idle', SCANNING: 'scanning', CONNECTING: 'connecting', INITIALIZING: 'initializing', CONNECTED: 'connected', ERROR: 'error' };

export default function OBD2Screen() {
  const [state, setState] = useState(STATES.IDLE);
  const [devices, setDevices] = useState([]);
  const [connected, setConnected] = useState(null);
  const [liveData, setLiveData] = useState({});
  const [log, setLog] = useState([]);
  const [dtcs, setDtcs] = useState([]);
  const deviceRef = useRef(null);
  const charRef = useRef(null);
  const pollingRef = useRef(null);
  const bufferRef = useRef('');

  useEffect(() => () => {
    clearInterval(pollingRef.current);
    deviceRef.current?.cancelConnection();
    bleManager.stopDeviceScan();
  }, []);

  const addLog = (msg) => setLog(l => [`${new Date().toLocaleTimeString()}: ${msg}`, ...l.slice(0, 50)]);

  const scan = async () => {
    const granted = await requestBLEPermissions();
    if (!granted) { Alert.alert('Permission Required', 'Bluetooth permission is required.'); return; }

    setState(STATES.SCANNING);
    setDevices([]);
    addLog('Scanning for OBD2 devices...');

    bleManager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) { addLog(`Scan error: ${error.message}`); setState(STATES.ERROR); return; }
      if (device?.name) {
        setDevices(d => {
          if (d.find(x => x.id === device.id)) return d;
          return [...d, { id: device.id, name: device.name, rssi: device.rssi }];
        });
      }
    });

    setTimeout(() => {
      bleManager.stopDeviceScan();
      setState(STATES.IDLE);
      addLog('Scan complete');
    }, 10000);
  };

  const connect = async (device) => {
    bleManager.stopDeviceScan();
    setState(STATES.CONNECTING);
    addLog(`Connecting to ${device.name}...`);

    try {
      const d = await bleManager.connectToDevice(device.id, { timeout: 10000 });
      await d.discoverAllServicesAndCharacteristics();
      deviceRef.current = d;

      // Find writable characteristic
      const services = await d.services();
      let writeChar = null, notifyChar = null;

      for (const svc of services) {
        const chars = await svc.characteristics();
        for (const c of chars) {
          if (c.isWritableWithResponse || c.isWritableWithoutResponse) writeChar = c;
          if (c.isNotifiable || c.isIndicatable) notifyChar = c;
        }
      }

      if (!writeChar) throw new Error('No writable characteristic found');
      charRef.current = writeChar;

      // Subscribe to notifications
      if (notifyChar) {
        notifyChar.monitor((err, char) => {
          if (err || !char?.value) return;
          const decoded = atob(char.value);
          bufferRef.current += decoded;
          const lines = bufferRef.current.split('\r');
          bufferRef.current = lines.pop();
          lines.forEach(line => processResponse(line.trim()));
        });
      }

      setState(STATES.INITIALIZING);
      addLog('Connected! Initializing ELM327...');
      await initELM327(writeChar);

    } catch (e) {
      addLog(`Connection failed: ${e.message}`);
      setState(STATES.ERROR);
    }
  };

  const sendCommand = async (cmd) => {
    if (!charRef.current) return;
    try {
      const b64 = btoa(cmd);
      await charRef.current.writeWithResponse(b64);
    } catch (e) { addLog(`Write error: ${e.message}`); }
  };

  const initELM327 = async (char) => {
    charRef.current = char;
    for (const cmd of Object.values(AT_COMMANDS)) {
      await sendCommand(cmd);
      await new Promise(r => setTimeout(r, 300));
    }
    setState(STATES.CONNECTED);
    setConnected(deviceRef.current.name);
    addLog('ELM327 initialized. Live data active.');
    startPolling();
  };

  let pidIndex = 0;
  const startPolling = () => {
    pollingRef.current = setInterval(async () => {
      const pid = LIVE_PIDS[pidIndex % LIVE_PIDS.length];
      pidIndex++;
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

  const readDTCs = async () => {
    addLog('Reading fault codes...');
    await sendCommand('03\r');
  };

  const clearDTCs = () => {
    Alert.alert('Clear Fault Codes', 'This will clear all stored DTCs. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => { await sendCommand('04\r'); addLog('DTCs cleared.'); setDtcs([]); } },
    ]);
  };

  const disconnect = () => {
    clearInterval(pollingRef.current);
    deviceRef.current?.cancelConnection();
    deviceRef.current = null; charRef.current = null;
    setState(STATES.IDLE); setConnected(null); setLiveData({});
    addLog('Disconnected.');
  };

  const statusColor = { [STATES.CONNECTED]: '#4caf50', [STATES.SCANNING]: '#ffeb3b', [STATES.CONNECTING]: '#ff9800', [STATES.ERROR]: '#e51515', [STATES.IDLE]: '#555' };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>OBD2</Text>
      <Text style={styles.subtitle}>Live Vehicle Data</Text>

      {/* Status */}
      <View style={styles.statusBar}>
        <View style={[styles.statusDot, { backgroundColor: statusColor[state] || '#555' }]} />
        <Text style={styles.statusText}>
          {connected ? `Connected: ${connected}` : state.toUpperCase()}
        </Text>
        {connected && <TouchableOpacity onPress={disconnect} style={styles.disconnectBtn}><Text style={styles.disconnectText}>Disconnect</Text></TouchableOpacity>}
      </View>

      {/* Actions */}
      {!connected && (
        <View style={styles.row}>
          <TouchableOpacity style={[styles.actionBtn, state === STATES.SCANNING && styles.actionBtnActive]} onPress={scan} disabled={state === STATES.SCANNING || state === STATES.CONNECTING}>
            <Text style={styles.actionBtnText}>{state === STATES.SCANNING ? '🔍 Scanning...' : '🔍 Scan for OBD2'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Device List */}
      {devices.length > 0 && !connected && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Found Devices</Text>
          {devices.map(d => (
            <TouchableOpacity key={d.id} style={styles.deviceRow} onPress={() => connect(d)}>
              <View>
                <Text style={styles.deviceName}>{d.name}</Text>
                <Text style={styles.deviceId}>{d.id}</Text>
              </View>
              <Text style={styles.connectTap}>Tap to connect →</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Live Data Grid */}
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

      {/* DTC Section */}
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
  statusBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, marginBottom: 14 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { color: '#fff', fontWeight: '600', flex: 1 },
  disconnectBtn: { borderWidth: 1, borderColor: '#e51515', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  disconnectText: { color: '#e51515', fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actionBtn: { flex: 1, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#e51515', borderRadius: 10, padding: 16, alignItems: 'center' },
  actionBtnActive: { backgroundColor: '#1e0000' },
  actionBtnText: { color: '#e51515', fontWeight: '700', fontSize: 15 },
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
