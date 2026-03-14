import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, StatusBar, RefreshControl, TextInput,
} from 'react-native';

const FUEL_OPTIONS    = ['E0', 'E30', 'E50', 'E85'];
const ENGINE_OPTIONS  = ['N55', 'B58', 'S55', 'S63', 'S58', 'N20', 'Other'];
const GEAR_OPTIONS    = ['Any', '3', '4', '5', '6'];
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { analyzeLog, getAnalysisHistory, clearAnalysisHistory } from '../services/LogAnalyzerService';
import { getLocalUser } from '../services/AuthService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCENT = '#00ff88';
const RED    = '#ff4444';
const YELLOW = '#ffcc00';
const BG     = '#0a0a0a';
const CARD   = '#111';
const BORDER = '#222';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function scoreColor(score) {
  if (score >= 80) return ACCENT;
  if (score >= 60) return YELLOW;
  return RED;
}

function statusColor(status) {
  if (status === 'OK')       return ACCENT;
  if (status === 'WARNING')  return YELLOW;
  if (status === 'CRITICAL') return RED;
  return '#555';
}

function fmt(val) {
  if (val === null || val === undefined) return '—';
  return typeof val === 'number' ? val.toFixed(1) : val;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Channel display config ───────────────────────────────────────────────────
const CHANNELS = [
  { key: 'coolant', label: 'Coolant Temp',    icon: '🌡️', unit: '°C' },
  { key: 'iat',     label: 'Intake Air Temp', icon: '💨', unit: '°C' },
  { key: 'timing',  label: 'Ignition Timing', icon: '⚡', unit: '°' },
  { key: 'knock',   label: 'Knock / Retard',  icon: '🔔', unit: '°' },
  { key: 'afr',     label: 'AFR / Lambda',    icon: '🔥', unit: '' },
  { key: 'boost',   label: 'Boost Pressure',  icon: '💪', unit: 'psi' },
  { key: 'battery', label: 'Battery Voltage', icon: '🔋', unit: 'V' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function ChannelCard({ ch, data }) {
  if (!data) return null;
  const color = statusColor(data.status);
  const isNA  = data.status === 'N/A';

  return (
    <View style={styles.channelCard}>
      <View style={styles.channelHeader}>
        <Text style={styles.channelIcon}>{ch.icon}</Text>
        <Text style={styles.channelLabel}>{ch.label}</Text>
        <View style={[styles.statusBadge, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[styles.statusText, { color }]}>{data.status}</Text>
        </View>
      </View>
      {!isNA && (
        <View style={styles.channelStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>MIN</Text>
            <Text style={styles.statValue}>{fmt(data.min)}{ch.unit}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>AVG</Text>
            <Text style={styles.statValue}>{fmt(data.avg)}{ch.unit}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>MAX</Text>
            <Text style={styles.statValue}>{fmt(data.max)}{ch.unit}</Text>
          </View>
        </View>
      )}
      {data.note ? <Text style={styles.channelNote}>{data.note}</Text> : null}
    </View>
  );
}

function ScoreRing({ score }) {
  const color = scoreColor(score);
  return (
    <View style={[styles.scoreRing, { borderColor: color }]}>
      <Text style={[styles.scoreNumber, { color }]}>{score}</Text>
      <Text style={styles.scoreLabel}>HEALTH</Text>
    </View>
  );
}

function ReportView({ report, onReset }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.reportScroll}>
      {/* Score + Summary */}
      <View style={styles.reportHeader}>
        <ScoreRing score={report.healthScore} />
        <View style={styles.reportMeta}>
          <Text style={styles.reportFilename} numberOfLines={2}>{report.filename}</Text>
          <Text style={styles.reportCar}>{report.carName}</Text>
          <Text style={styles.reportRows}>{report.totalRows?.toLocaleString()} rows analyzed</Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryText}>{report.summary}</Text>
      </View>

      {/* Channels */}
      <Text style={styles.sectionTitle}>CHANNEL ANALYSIS</Text>
      {CHANNELS.map(ch => (
        <ChannelCard key={ch.key} ch={ch} data={report.channels?.[ch.key]} />
      ))}

      {/* Recommendations */}
      {report.recommendations?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
          <View style={styles.recCard}>
            {report.recommendations.map((rec, i) => (
              <View key={i} style={styles.recRow}>
                <Text style={styles.recBullet}>→</Text>
                <Text style={styles.recText}>{rec}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
        <Ionicons name="add-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.resetBtnText}>Analyze Another Log</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function HistoryView({ history, onSelect, onClear }) {
  if (history.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📂</Text>
        <Text style={styles.emptyText}>No analyses yet</Text>
        <Text style={styles.emptySubtext}>Upload a BM3 log to get started</Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {history.map(item => (
        <TouchableOpacity key={item.id} style={styles.historyItem} onPress={() => onSelect(item)}>
          <View style={styles.historyLeft}>
            <View style={[styles.historyScore, { borderColor: scoreColor(item.healthScore) }]}>
              <Text style={[styles.historyScoreNum, { color: scoreColor(item.healthScore) }]}>
                {item.healthScore}
              </Text>
            </View>
          </View>
          <View style={styles.historyInfo}>
            <Text style={styles.historyFilename} numberOfLines={1}>{item.filename}</Text>
            <Text style={styles.historyCar}>{item.carName}</Text>
            <Text style={styles.historyDate}>{formatDate(item.date)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#555" />
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.clearBtn} onPress={onClear}>
        <Text style={styles.clearBtnText}>Clear History</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function LogAnalyzerScreen() {
  const [tab, setTab]               = useState('analyze');
  const [file, setFile]             = useState(null);
  const [loading, setLoading]       = useState(false);
  const [report, setReport]         = useState(null);
  const [history, setHistory]       = useState([]);
  const [user, setUser]             = useState(null);
  const [carName, setCarName]       = useState('');
  const [fuelType, setFuelType]     = useState('E0');
  const [engineFamily, setEngine]   = useState('Other');
  const [gear, setGear]             = useState('Any');

  useEffect(() => {
    getLocalUser().then(u => setUser(u));
    loadHistory();
    loadCarName();
  }, []);

  const loadHistory = async () => {
    const h = await getAnalysisHistory();
    setHistory(h);
  };

  const loadCarName = async () => {
    try {
      const raw = await AsyncStorage.getItem('car_profile');
      if (raw) {
        const profile = JSON.parse(raw);
        const name = [profile.year, profile.make, profile.model].filter(Boolean).join(' ');
        setCarName(name || '');
      }
    } catch {}
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      setFile({ name: asset.name, uri: asset.uri, size: asset.size });
      setReport(null);
    } catch (e) {
      Alert.alert('Error', 'Could not open file: ' + e.message);
    }
  };

  const runAnalysis = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const content = await FileSystem.readAsStringAsync(file.uri);
      const result = await analyzeLog({
        fileContent:  content,
        filename:     file.name,
        uid:          user?.uid,
        carName,
        fuelType:     fuelType.toLowerCase(),
        engineFamily: engineFamily === 'Other' ? 'other' : engineFamily,
        gear:         gear === 'Any' ? null : gear,
      });
      setReport(result);
      loadHistory();
    } catch (e) {
      Alert.alert('Analysis Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    Alert.alert('Clear History', 'Delete all saved analyses?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        await clearAnalysisHistory();
        setHistory([]);
      }},
    ]);
  };

  const resetAnalyze = () => {
    setFile(null);
    setReport(null);
  };

  const fileSizeLabel = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'analyze' && styles.tabBtnActive]}
          onPress={() => setTab('analyze')}
        >
          <Text style={[styles.tabBtnText, tab === 'analyze' && styles.tabBtnTextActive]}>
            Analyze
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'history' && styles.tabBtnActive]}
          onPress={() => { setTab('history'); loadHistory(); }}
        >
          <Text style={[styles.tabBtnText, tab === 'history' && styles.tabBtnTextActive]}>
            History {history.length > 0 ? `(${history.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Analyze Tab */}
      {tab === 'analyze' && (
        <>
          {report ? (
            <ReportView report={report} onReset={resetAnalyze} />
          ) : (
            <ScrollView contentContainerStyle={styles.analyzeContainer}>
              <Text style={styles.pageTitle}>BM3 Log Analyzer</Text>
              <Text style={styles.pageSubtitle}>
                Upload a BM3 datalog CSV and get an instant AI health report
              </Text>

              {/* Tune Config */}
              <View style={styles.configCard}>
                <View style={styles.configRow}>
                  <Text style={styles.configLabel}>ENGINE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.pillRow}>
                      {ENGINE_OPTIONS.map(e => (
                        <TouchableOpacity
                          key={e}
                          style={[styles.pill, engineFamily === e && styles.pillActive]}
                          onPress={() => setEngine(e)}
                        >
                          <Text style={[styles.pillText, engineFamily === e && styles.pillTextActive]}>{e}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                <View style={styles.configRow}>
                  <Text style={styles.configLabel}>FUEL</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.pillRow}>
                      {FUEL_OPTIONS.map(f => (
                        <TouchableOpacity
                          key={f}
                          style={[styles.pill, fuelType === f && styles.pillActive]}
                          onPress={() => setFuelType(f)}
                        >
                          <Text style={[styles.pillText, fuelType === f && styles.pillTextActive]}>{f}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                <View style={styles.configRow}>
                  <Text style={styles.configLabel}>GEAR</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.pillRow}>
                      {GEAR_OPTIONS.map(g => (
                        <TouchableOpacity
                          key={g}
                          style={[styles.pill, gear === g && styles.pillActive]}
                          onPress={() => setGear(g)}
                        >
                          <Text style={[styles.pillText, gear === g && styles.pillTextActive]}>{g === 'Any' ? 'Any Gear' : `Gear ${g}`}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>

              {/* Upload Box */}
              <TouchableOpacity style={styles.uploadBox} onPress={pickFile} activeOpacity={0.7}>
                {file ? (
                  <View style={styles.fileInfo}>
                    <Ionicons name="document-text" size={32} color={ACCENT} />
                    <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
                    <Text style={styles.fileSize}>{fileSizeLabel(file.size)}</Text>
                    <Text style={styles.fileTapChange}>Tap to change</Text>
                  </View>
                ) : (
                  <View style={styles.uploadPrompt}>
                    <Ionicons name="cloud-upload-outline" size={44} color="#444" />
                    <Text style={styles.uploadText}>Tap to upload BM3 log</Text>
                    <Text style={styles.uploadSubtext}>.csv or .txt file</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Info pills */}
              <View style={styles.infoPills}>
                <View style={styles.pill}><Text style={styles.pillText}>⚡ AI-powered</Text></View>
                <View style={styles.pill}><Text style={styles.pillText}>🔒 Secure</Text></View>
                <View style={styles.pill}><Text style={styles.pillText}>⏱ ~10 seconds</Text></View>
              </View>

              {/* Analyze Button */}
              <TouchableOpacity
                style={[styles.analyzeBtn, (!file || loading) && styles.analyzeBtnDisabled]}
                onPress={runAnalysis}
                disabled={!file || loading}
              >
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#000" size="small" style={{ marginRight: 10 }} />
                    <Text style={styles.analyzeBtnText}>Analyzing your log...</Text>
                  </View>
                ) : (
                  <Text style={styles.analyzeBtnText}>
                    {file ? '🔍  Analyze Log' : 'Select a file first'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* What we check */}
              <View style={styles.checkList}>
                <Text style={styles.checkTitle}>What we check</Text>
                {CHANNELS.map(ch => (
                  <View key={ch.key} style={styles.checkRow}>
                    <Text style={styles.checkIcon}>{ch.icon}</Text>
                    <Text style={styles.checkLabel}>{ch.label}</Text>
                  </View>
                ))}
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <View style={styles.historyContainer}>
          <HistoryView
            history={history}
            onSelect={(item) => { setReport(item); setTab('analyze'); }}
            onClear={handleClearHistory}
          />
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Tabs
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: BG },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: ACCENT },
  tabBtnText: { color: '#555', fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
  tabBtnTextActive: { color: ACCENT },

  // Analyze Tab
  analyzeContainer: { padding: 20 },
  pageTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  pageSubtitle: { color: '#666', fontSize: 14, marginBottom: 24, lineHeight: 20 },

  configCard: {
    backgroundColor: CARD, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: BORDER, marginBottom: 16, gap: 14,
  },
  configRow: { gap: 8 },
  configLabel: { color: '#444', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#333', backgroundColor: '#0a0a0a',
  },
  pillActive: { borderColor: ACCENT, backgroundColor: ACCENT + '22' },
  pillText: { color: '#555', fontSize: 12, fontWeight: '700' },
  pillTextActive: { color: ACCENT },

  uploadBox: {
    borderWidth: 2, borderColor: '#333', borderStyle: 'dashed',
    borderRadius: 16, padding: 32, alignItems: 'center',
    backgroundColor: '#0f0f0f', marginBottom: 20,
  },
  uploadPrompt: { alignItems: 'center' },
  uploadText: { color: '#888', fontSize: 16, fontWeight: '600', marginTop: 12 },
  uploadSubtext: { color: '#555', fontSize: 13, marginTop: 4 },
  fileInfo: { alignItems: 'center' },
  fileName: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  fileSize: { color: '#666', fontSize: 13, marginTop: 4 },
  fileTapChange: { color: ACCENT, fontSize: 12, marginTop: 8 },

  infoPills: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  pill: { backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: BORDER },
  pillText: { color: '#888', fontSize: 12 },

  analyzeBtn: {
    backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', marginBottom: 28,
  },
  analyzeBtnDisabled: { backgroundColor: '#1a1a1a' },
  analyzeBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },

  checkList: { backgroundColor: CARD, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BORDER },
  checkTitle: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  checkIcon: { fontSize: 16, marginRight: 12 },
  checkLabel: { color: '#888', fontSize: 14 },

  // Report
  reportScroll: { padding: 20 },
  reportHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 16 },
  scoreRing: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#111',
  },
  scoreNumber: { fontSize: 24, fontWeight: '900' },
  scoreLabel: { color: '#555', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  reportMeta: { flex: 1 },
  reportFilename: { color: '#fff', fontSize: 14, fontWeight: '700' },
  reportCar: { color: ACCENT, fontSize: 12, marginTop: 2 },
  reportRows: { color: '#555', fontSize: 11, marginTop: 2 },

  summaryCard: {
    backgroundColor: '#0f1f18', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: ACCENT + '33', marginBottom: 20,
  },
  summaryText: { color: '#ccc', fontSize: 14, lineHeight: 21 },

  sectionTitle: {
    color: '#444', fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    marginBottom: 10, marginTop: 4,
  },

  channelCard: {
    backgroundColor: CARD, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: BORDER, marginBottom: 8,
  },
  channelHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  channelIcon: { fontSize: 16, marginRight: 8 },
  channelLabel: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  statusBadge: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  channelStats: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  statItem: { flex: 1, alignItems: 'center', backgroundColor: '#0a0a0a', borderRadius: 8, padding: 8 },
  statLabel: { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  statValue: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 2 },
  channelNote: { color: '#888', fontSize: 12, lineHeight: 18 },

  recCard: {
    backgroundColor: CARD, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: BORDER, marginBottom: 20, gap: 10,
  },
  recRow: { flexDirection: 'row', gap: 8 },
  recBullet: { color: ACCENT, fontWeight: '800', fontSize: 14 },
  recText: { color: '#ccc', fontSize: 13, lineHeight: 19, flex: 1 },

  resetBtn: {
    borderWidth: 1, borderColor: '#333', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  resetBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // History
  historyContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  historyItem: {
    backgroundColor: CARD, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
    borderWidth: 1, borderColor: BORDER,
  },
  historyLeft: { marginRight: 12 },
  historyScore: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  historyScoreNum: { fontSize: 14, fontWeight: '900' },
  historyInfo: { flex: 1 },
  historyFilename: { color: '#fff', fontSize: 13, fontWeight: '700' },
  historyCar: { color: ACCENT, fontSize: 12, marginTop: 2 },
  historyDate: { color: '#555', fontSize: 11, marginTop: 2 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptySubtext: { color: '#555', fontSize: 13, marginTop: 4 },

  clearBtn: { marginTop: 16, alignItems: 'center', padding: 12 },
  clearBtnText: { color: '#555', fontSize: 13 },
});
