import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Clipboard } from 'react-native';
import { bleManager, requestBLEPermissions } from '../services/BLEManager';
import { PIDS, parseOBD2Response, AT_COMMANDS } from '../services/OBD2Service';
import { atob, btoa } from 'react-native-quick-base64';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import { setConnectedCar, clearConnectedCar, decodeVIN, parseVINFromOBD2 } from '../services/CarDataStore';

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
  const [carInfo, setCarInfo] = useState(null);

  // Refs that work for both transports
  const classicDeviceRef = useRef(null);  // BluetoothClassic device
  const bleDeviceRef = useRef(null);      // BLE device
  const bleCharRef = useRef(null);        // BLE write characteristic
  const pollingRef = useRef(null);       // holds { running: bool }
  const responseResolveRef = useRef(null); // resolves when '>' prompt received
  const bufferRef = useRef('');
  const classicSubRef = useRef(null);     // Classic data subscription
  const pidIndexRef = useRef(0);

  // Fix stale closure on processResponse
  const processResponseRef = useRef(null);

  // Change 5: Keep connection alive on navigate away — only stop scanning on unmount
  useEffect(() => () => { bleManager.stopDeviceScan(); }, []);

  const cleanup = () => {
    if (pollingRef.current) pollingRef.current.running = false;
    classicSubRef.current?.remove();
    classicDeviceRef.current?.disconnect?.();
    bleDeviceRef.current?.cancelConnection?.();
    bleManager.stopDeviceScan();
  };

  // Change 4: increase buffer to 200
  const addLog = (msg) => setLog(l => [`${new Date().toLocaleTimeString()}: ${msg}`, ...l.slice(0, 199)]);

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

      // Use dev.onDataReceived() — avoids address mismatch with module-level onDeviceRead
      classicSubRef.current = dev.onDataReceived((event) => {
        const chunk = (event?.data ?? event ?? '').toString();
        if (!chunk) return;
        addLog(`RAW: ${chunk.replace(/[\r\n]/g, '↵').substring(0, 60)}`);
        bufferRef.current += chunk;
        // Resolve pending response promise on '>' OR 'STOPPED' (multi-ECU end marker)
        if ((chunk.includes('>') || chunk.toUpperCase().includes('STOPPED')) && responseResolveRef.current) {
          const res = responseResolveRef.current;
          responseResolveRef.current = null;
          res();
        }
        // Split on \r or \n (handle both ELM327 line endings)
        const lines = bufferRef.current.split(/[\r\n]+/);
        bufferRef.current = lines.pop() ?? '';
        // Change 3: use ref to avoid stale closure
        lines.forEach(line => { if (line.trim()) processResponseRef.current?.(line.trim()); });
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
    for (const [key, cmd] of Object.entries(AT_COMMANDS)) {
      await writeClassic(cmd);
      await delay(key === 'RESET' ? 1500 : 300);
    }
    setState(STATES.CONNECTED);
    setConnected(classicDeviceRef.current?.name || 'Classic Device');
    addLog('ELM327 initialized. Reading VIN...');
    await readVIN();   // finish VIN before starting live polling
    addLog('Starting live data...');
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
      addLog(`Services found: ${services.length}`);

      // Log all services + characteristics for debugging
      const allChars = [];
      for (const svc of services) {
        const chars = await svc.characteristics();
        addLog(`SVC: ${svc.uuid.substring(0,8)} → ${chars.length} chars`);
        chars.forEach(c => {
          addLog(`  CHAR: ${c.uuid.substring(0,8)} W:${c.isWritableWithResponse||c.isWritableWithoutResponse} N:${c.isNotifiable||c.isIndicatable}`);
          allChars.push(c);
        });
      }

      // Extract the meaningful short UUID from any BLE UUID format
      // Handles: "fff1", "0000fff1", "0000fff1-0000-1000-8000-00805f9b34fb"
      const shortUUID = (uuid) => {
        const clean = uuid.toLowerCase().replace(/-/g, '');
        // Standard BLE 128-bit UUID: 0000XXXX0000100080000000805f9b34fb
        if (clean.length === 32 && clean.endsWith('00001000800000805f9b34fb')) {
          return clean.substring(4, 8); // e.g. "fff1"
        }
        if (clean.length === 8) return clean.substring(4); // "0000fff1" → "fff1"
        if (clean.length === 4) return clean;               // "fff1" → "fff1"
        return clean.substring(0, 8); // fallback
      };

      // Generic BLE service chars — never OBD2 data
      const BLACKLIST = new Set(['2a00','2a01','2a02','2a03','2a04','2a05','2a23','2a24','2a25','2b2a','2b29']);

      // Known OBD2 adapter write UUIDs (Veepeak/Vgate/OBDLink)
      const WRITE_PRIORITY  = ['fff2','ffe2','beef','6387'];
      // Known OBD2 adapter notify UUIDs
      const NOTIFY_PRIORITY = ['fff1','ffe1','6487'];

      const isBlacklisted = (c) => BLACKLIST.has(shortUUID(c.uuid));
      const canWrite  = (c) => (c.isWritableWithResponse || c.isWritableWithoutResponse) && !isBlacklisted(c);
      const canNotify = (c) => (c.isNotifiable || c.isIndicatable) && !isBlacklisted(c);

      // Priority match first, then fallback to any non-blacklisted char
      let writeChar  = allChars.find(c => WRITE_PRIORITY.includes(shortUUID(c.uuid))  && canWrite(c))
                    ?? allChars.find(c => canWrite(c));
      let notifyChar = allChars.find(c => NOTIFY_PRIORITY.includes(shortUUID(c.uuid)) && canNotify(c))
                    ?? allChars.find(c => canNotify(c));

      // Special case: Veepeak uses a single char (6487) for both write AND notify
      // If we found a char that does both and nothing better — use it for both
      const dualChar = allChars.find(c => canWrite(c) && canNotify(c) && !BLACKLIST.has(shortUUID(c.uuid)));
      if (dualChar && (!writeChar || !notifyChar)) {
        writeChar  = writeChar  ?? dualChar;
        notifyChar = notifyChar ?? dualChar;
      }

      addLog(`Write char: ${writeChar?.uuid?.substring(0,8) || 'NONE'}`);
      addLog(`Notify char: ${notifyChar?.uuid?.substring(0,8) || 'NONE'}`);

      if (!writeChar) throw new Error('No writable characteristic found');
      bleCharRef.current = writeChar;

      if (notifyChar) {
        notifyChar.monitor((err, char) => {
          if (err || !char?.value) return;
          const chunk = atob(char.value);
          // Always log raw during VIN capture so we can debug what the adapter sends
          if (vinCaptureRef.current) {
            addLog(`VIN RAW: ${chunk.replace(/[\r\n]/g, '↵').substring(0, 80)}`);
          } else {
            addLog(`RAW: ${chunk.replace(/[\r\n>]/g, '↵').substring(0, 60)}`);
          }
          bufferRef.current += chunk;
          // Resolve pending command on '>' prompt OR 'STOPPED' (multi-ECU end marker)
          const bufUpper = bufferRef.current.toUpperCase();
          if ((bufferRef.current.includes('>') || bufUpper.includes('STOPPED')) && responseResolveRef.current) {
            const res = responseResolveRef.current;
            responseResolveRef.current = null;
            bufferRef.current = bufferRef.current.replace(/>/g, '').replace(/STOPPED/gi, '');
            res();
          }
          const lines = bufferRef.current.split(/[\r\n]+/);
          bufferRef.current = lines.pop() ?? '';
          // Change 3: use ref to avoid stale closure
          lines.forEach(line => { if (line.trim()) processResponseRef.current?.(line.trim()); });
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
    for (const [key, cmd] of Object.entries(AT_COMMANDS)) {
      await writeBLE(cmd);
      await delay(key === 'RESET' ? 1500 : 300);
    }
    setState(STATES.CONNECTED);
    setConnected(bleDeviceRef.current?.name || 'BLE Device');
    addLog('ELM327 initialized. Reading VIN...');
    await readVIN();   // finish VIN before starting live polling
    addLog('Starting live data...');
    startPolling();
  };

  const writeBLE = async (cmd) => {
    try {
      const c = bleCharRef.current;
      if (!c) { addLog('Write error: no char'); return; }
      const encoded = btoa(cmd);
      // Use device-level write with serviceUUID + charUUID — avoids "Characteristic N not found" stale ref errors
      const dev = bleDeviceRef.current;
      if (dev && c.serviceUUID) {
        if (c.isWritableWithoutResponse) {
          await dev.writeCharacteristicWithoutResponseForService(c.serviceUUID, c.uuid, encoded);
        } else {
          await dev.writeCharacteristicWithResponseForService(c.serviceUUID, c.uuid, encoded);
        }
      } else {
        // Fallback to char ref
        if (c.isWritableWithoutResponse) {
          await c.writeWithoutResponse(encoded);
        } else {
          await c.writeWithResponse(encoded);
        }
      }
    } catch (e) { addLog(`Write error: ${e.message}`); }
  };

  // ─── VIN READING ──────────────────────────────────────────────────────────────
  const vinLinesRef = useRef([]);
  const vinCaptureRef = useRef(false); // true while actively collecting VIN response
  // Change 1: abort VIN early on SEARCHING/STOPPED
  const vinAbortRef = useRef(false);

  const readVIN = async () => {
    addLog('Reading VIN...');

    // Try up to 3 times
    for (let attempt = 1; attempt <= 3; attempt++) {
      vinLinesRef.current = [];
      vinCaptureRef.current = true;
      vinAbortRef.current = false;
      addLog(`VIN attempt ${attempt}/3...`);

      // 0902 — Mode 09 PID 02 (VIN), no space for max compatibility
      await sendCommand('0902\r');

      // Change 1: Poll every 100ms instead of flat 4000ms delay — abort early on SEARCHING/STOPPED
      const maxWaitMs = 4000;
      const pollIntervalMs = 100;
      let elapsed = 0;
      while (elapsed < maxWaitMs) {
        await delay(pollIntervalMs);
        elapsed += pollIntervalMs;
        if (vinAbortRef.current) {
          addLog(`VIN aborted early (SEARCHING/STOPPED) after ${elapsed}ms`);
          break;
        }
      }
      vinCaptureRef.current = false;

      addLog(`VIN lines captured: ${vinLinesRef.current.length}`);
      vinLinesRef.current.forEach((l, i) => addLog(`  VIN[${i}]: ${l.substring(0,50)}`));

      const vin = parseVINFromOBD2(vinLinesRef.current);
      if (vin) {
        addLog(`VIN: ${vin} — decoding...`);
        const car = await decodeVIN(vin);
        if (car) {
          setConnectedCar(car);
          setCarInfo(car);
          addLog(`✅ ${car.year} ${car.make} ${car.model} ${car.engine}`);
        } else {
          addLog(`VIN ${vin} — NHTSA decode failed`);
        }
        return;
      }

      // If aborted (Euro car with no VIN support), don't bother retrying
      if (vinAbortRef.current) {
        addLog('VIN not supported by this vehicle — skipping retries');
        return;
      }

      await delay(500);
    }
    addLog('VIN not available from this adapter');
  };

  // ─── SHARED ──────────────────────────────────────────────────────────────────
  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  const sendCommand = (cmd) => transport === 'classic' ? writeClassic(cmd) : writeBLE(cmd);

  const startPolling = () => {
    if (pollingRef.current) pollingRef.current.running = false;
    const handle = { running: true };
    pollingRef.current = handle;
    pidIndexRef.current = 0;

    (async () => {
      while (handle.running) {
        const pid = LIVE_PIDS[pidIndexRef.current % LIVE_PIDS.length];
        pidIndexRef.current++;
        // Send command and wait for '>' prompt (max 1500ms)
        await new Promise(resolve => {
          responseResolveRef.current = resolve;
          sendCommand(pid.cmd);
          setTimeout(() => { responseResolveRef.current = null; resolve(); }, 1500);
        });
        responseResolveRef.current = null;
        if (handle.running) await delay(30); // small gap between commands
      }
    })();
  };

  const processResponse = (line) => {
    // '>' prompt OR 'STOPPED' = ELM327 done collecting responses — resolve pending command
    const upper = line.toUpperCase().trim();
    if ((line.includes('>') || upper === 'STOPPED') && responseResolveRef.current) {
      const res = responseResolveRef.current;
      responseResolveRef.current = null;
      res();
    }

    // Capture ALL lines while VIN capture is active — don't filter by prefix here,
    // the parser handles extraction. This catches headers-on ISO-TP frames too.
    if (vinCaptureRef.current) {
      const upper = line.toUpperCase().replace(/\s/g, '');
      // Change 1: detect SEARCHING/STOPPED immediately and abort VIN wait
      if (upper.includes('SEARCHING') || upper.includes('STOPPED')) {
        vinAbortRef.current = true;
      }
      // Only capture lines that contain hex data (not echo/prompt/OK)
      if (upper.length > 0 &&
          upper !== 'OK' && upper !== '>' &&
          !upper.startsWith('ATH') &&
          !upper.startsWith('0902') &&      // skip echo of our own command
          /[0-9A-F]{4,}/.test(upper)) {
        vinLinesRef.current.push(line);
        addLog(`VIN frame: ${line.substring(0, 50)}`);
      }
      return; // don't try to parse as live PID during VIN read
    }

    // Skip known non-data responses
    const upper = line.toUpperCase();
    if (upper === 'OK' || upper.startsWith('AT') || upper === 'ELM327' ||
        upper.startsWith('SEARCHING') || upper === 'NO DATA' ||
        upper === 'UNABLE TO CONNECT' || upper === 'BUS INIT' || upper === '>') return;

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
    clearConnectedCar();
    setCarInfo(null);
    addLog('Disconnected.');
  };

  const handleScan = () => transport === 'classic' ? loadPairedDevices() : scanBLE();
  const handleConnect = (device) => transport === 'classic' ? connectClassic(device) : connectBLE(device);

  const statusColor = { [STATES.CONNECTED]: '#4caf50', [STATES.SCANNING]: '#ffeb3b', [STATES.CONNECTING]: '#ff9800', [STATES.INITIALIZING]: '#ff9800', [STATES.ERROR]: '#e51515', [STATES.IDLE]: '#555' };

  // Change 3: keep processResponseRef in sync just before render
  processResponseRef.current = processResponse;

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

      {/* Car identity card — shown after VIN is decoded via OBD2 */}
      {carInfo && (
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#4caf50' }]}>
          <Text style={[styles.sectionTitle, { color: '#4caf50' }]}>✅ Vehicle Verified (OBD2)</Text>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 2 }}>{carInfo.year} {carInfo.make} {carInfo.model}</Text>
          <Text style={{ color: '#666', fontSize: 12 }}>{carInfo.engine}  ·  {carInfo.fuel}</Text>
          <Text style={{ color: '#333', fontSize: 10, marginTop: 4, marginBottom: 12 }}>VIN: {carInfo.vin}</Text>
          <TouchableOpacity
            style={styles.garageBtn}
            onPress={() => {
              Alert.alert('✅ Pushed to Garage', `${carInfo.year} ${carInfo.make} ${carInfo.model} is now your active vehicle for GPS timing and leaderboard submissions.`);
              addLog(`🏎️ Pushed to garage: ${carInfo.year} ${carInfo.make} ${carInfo.model}`);
            }}>
            <Text style={styles.garageBtnText}>🏎️ Push to Garage</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* VIN not available notice */}
      {connected && !carInfo && state === STATES.CONNECTED && (
        <View style={[styles.hintBox, { borderLeftColor: '#555' }]}>
          <Text style={[styles.hintText, { color: '#555' }]}>🔍 VIN not available — your car may use a proprietary protocol. Connect with engine running and try reconnecting.</Text>
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

      {/* Log — Change 4: show full log, no slice */}
      {log.length > 0 && (
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.sectionTitle}>Log</Text>
            <TouchableOpacity
              onPress={() => { Clipboard.setString(log.join('\n')); Alert.alert('Copied', 'Log copied to clipboard'); }}
              style={styles.copyBtn}>
              <Text style={styles.copyBtnText}>📋 Copy</Text>
            </TouchableOpacity>
          </View>
          {log.map((l, i) => <Text key={i} style={styles.logLine}>{l}</Text>)}
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
  copyBtn: { borderWidth: 1, borderColor: '#444', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  copyBtnText: { color: '#888', fontSize: 11, fontWeight: '600' },

  garageBtn: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#4caf50', borderRadius: 8, padding: 12, alignItems: 'center' },
  garageBtnText: { color: '#4caf50', fontWeight: '700', fontSize: 14 },
});
