import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getRuns, deleteRun } from '../utils/storage';

const TYPE_EMOJI = { 'Roll Race': '🏁', '0-60/0-100': '🚦', 'Trap Speed': '🏁' };

export default function RunLogbookScreen() {
  const [runs, setRuns] = useState([]);

  useFocusEffect(useCallback(() => { getRuns().then(setRuns); }, []));

  const handleDelete = (id, label) => {
    Alert.alert('Delete Run', `Remove "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteRun(id); getRuns().then(setRuns); } },
    ]);
  };

  const RunCard = ({ run }) => {
    const d = new Date(run.date);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const improved = parseFloat(run.correctedTime) < parseFloat(run.rawTime);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.runType}>{TYPE_EMOJI[run.type] || '⏱️'} {run.type} — {run.bracket}</Text>
            <Text style={styles.runDate}>{dateStr} · {timeStr}</Text>
            {run.car && <Text style={styles.runCar}>🚗 {run.car}</Text>}
          </View>
          <TouchableOpacity onPress={() => handleDelete(run.id, `${run.type} ${run.correctedTime}s`)}>
            <Text style={styles.deleteBtn}>🗑️</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.timesRow}>
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>Raw</Text>
            <Text style={styles.timeVal}>{run.rawTime}s</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
          <View style={[styles.timeBox, styles.timeBoxCorrected]}>
            <Text style={styles.timeLabel}>Corrected</Text>
            <Text style={[styles.timeValBig, { color: '#e51515' }]}>{run.correctedTime}s</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>📐 {run.slope > 0 ? '+' : ''}{run.slope}% slope</Text>
          {run.da && <Text style={styles.meta}>🌡️ {run.da.toLocaleString()} ft DA</Text>}
          {run.note && <Text style={styles.note}>"{run.note}"</Text>}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Run Logbook</Text>
      <Text style={styles.subtitle}>{runs.length} saved runs</Text>
      {runs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyText}>No runs saved yet</Text>
          <Text style={styles.emptyHint}>After calculating a corrected run, tap "Save Run" to log it here.</Text>
        </View>
      ) : (
        <FlatList data={runs} keyExtractor={r => String(r.id)} renderItem={({ item }) => <RunCard run={item} />}
          contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  title: { color: '#e51515', fontSize: 28, fontWeight: '800', marginTop: 12 },
  subtitle: { color: '#555', fontSize: 14, marginBottom: 16 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  runType: { color: '#fff', fontWeight: '700', fontSize: 14 },
  runDate: { color: '#555', fontSize: 12, marginTop: 2 },
  runCar: { color: '#888', fontSize: 12, marginTop: 2 },
  deleteBtn: { fontSize: 18, padding: 4 },
  timesRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  timeBox: { flex: 1, backgroundColor: '#111', borderRadius: 8, padding: 10, alignItems: 'center' },
  timeBoxCorrected: { borderWidth: 1, borderColor: '#e51515' },
  timeLabel: { color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  timeVal: { color: '#888', fontSize: 20, fontWeight: '700' },
  timeValBig: { fontSize: 24, fontWeight: '800' },
  arrow: { color: '#333', fontSize: 20, marginHorizontal: 8 },
  metaRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  meta: { color: '#666', fontSize: 12 },
  note: { color: '#888', fontSize: 12, fontStyle: 'italic', width: '100%', marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#555', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyHint: { color: '#333', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
