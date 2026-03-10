import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchLeaderboard } from '../services/LeaderboardService';

const BRACKETS = ['All', '0–60 mph', '0–100 mph', '60–130 mph', '100–150 mph', '100–200 mph'];

export default function LeaderboardScreen() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bracket, setBracket] = useState('All');
  const [filterMake, setFilterMake] = useState('');
  const [filterYear, setFilterYear] = useState('');

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    const data = await fetchLeaderboard({
      bracket: bracket === 'All' ? null : bracket,
      make: filterMake || null,
      year: filterYear || null,
      limitCount: 100,
    });
    setRuns(data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, [bracket]);

  const medal = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;

  return (
    <View style={s.root}>
      {/* Header */}
      <LinearGradient colors={['#1a0000', '#000']} style={s.header}>
        <Text style={s.title}>🏆 Leaderboard</Text>
        <Text style={s.subtitle}>Slope-corrected times · VIN verified</Text>
      </LinearGradient>

      {/* Bracket selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.bracketScroll} contentContainerStyle={s.bracketRow}>
        {BRACKETS.map(b => (
          <TouchableOpacity key={b} style={[s.bracketBtn, bracket === b && s.bracketActive]} onPress={() => setBracket(b)}>
            <Text style={[s.bracketTxt, bracket === b && s.bracketTxtActive]}>{b}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filters */}
      <View style={s.filterRow}>
        <TextInput
          style={s.filterInput}
          placeholder="Make (e.g. BMW)"
          placeholderTextColor="#333"
          value={filterMake}
          onChangeText={setFilterMake}
          onSubmitEditing={() => load()}
        />
        <TextInput
          style={[s.filterInput, { width: 80 }]}
          placeholder="Year"
          placeholderTextColor="#333"
          value={filterYear}
          onChangeText={setFilterYear}
          keyboardType="numeric"
          onSubmitEditing={() => load()}
        />
        <TouchableOpacity style={s.filterBtn} onPress={() => load()}>
          <Text style={s.filterBtnTxt}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}><ActivityIndicator color="#e51515" size="large" /></View>
      ) : runs.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>🏁</Text>
          <Text style={s.emptyText}>No runs yet.</Text>
          <Text style={s.emptyHint}>Complete a GPS run and tap{'\n'}"Submit to Leaderboard"</Text>
        </View>
      ) : (
        <ScrollView
          style={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#e51515" />}>
          {runs.map((run, i) => (
            <LinearGradient
              key={run.id || i}
              colors={i < 3 ? ['#1a0a00', '#0d0d0d'] : ['#111', '#0d0d0d']}
              style={s.card}>
              {/* Rank + time */}
              <View style={s.cardTop}>
                <Text style={s.rank}>{medal(i)}</Text>
                <View style={s.timeBlock}>
                  <Text style={s.corrTime}>{run.correctedTime?.toFixed(3) ?? '—'}s</Text>
                  <Text style={s.rawTime}>raw {run.rawTime?.toFixed(3) ?? '—'}s</Text>
                </View>
                <View style={s.right}>
                  {run.verified && <Text style={s.verifiedBadge}>✅ VIN</Text>}
                  <Text style={s.bracket}>{run.bracket}</Text>
                </View>
              </View>

              {/* Car info */}
              <Text style={s.carName}>
                {[run.carYear, run.carMake, run.carModel].filter(Boolean).join(' ') || 'Unknown Vehicle'}
              </Text>
              {run.carEngine ? <Text style={s.carEngine}>{run.carEngine}</Text> : null}

              {/* Stats row */}
              <View style={s.statsRow}>
                <Text style={s.stat}>📐 {run.slope?.toFixed(2) ?? '0'}% slope</Text>
                <Text style={s.stat}>🏁 {run.peakSpeed?.toFixed(1) ?? '—'} mph peak</Text>
                <Text style={s.stat}>📏 {run.distanceFt?.toFixed(0) ?? '—'}ft</Text>
              </View>

              {/* Date */}
              {run.timestamp?.toDate && (
                <Text style={s.date}>{run.timestamp.toDate().toLocaleDateString()}</Text>
              )}
            </LinearGradient>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { paddingTop: 20, paddingBottom: 16, paddingHorizontal: 16 },
  title: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: '#444', fontSize: 11, marginTop: 2, letterSpacing: 1 },

  bracketScroll: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: '#111' },
  bracketRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  bracketBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  bracketActive: { backgroundColor: '#1e0000', borderColor: '#e51515' },
  bracketTxt: { color: '#444', fontSize: 12, fontWeight: '600' },
  bracketTxtActive: { color: '#e51515' },

  filterRow: { flexDirection: 'row', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: '#111' },
  filterInput: { flex: 1, backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: '#fff', fontSize: 13, borderWidth: 1, borderColor: '#1e1e1e' },
  filterBtn: { backgroundColor: '#e51515', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  filterBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  emptyHint: { color: '#444', fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 },

  list: { flex: 1 },
  card: { marginHorizontal: 12, marginTop: 10, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1a1a1a' },

  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rank: { fontSize: 22, marginRight: 10, minWidth: 36 },
  timeBlock: { flex: 1 },
  corrTime: { color: '#e51515', fontSize: 28, fontWeight: '900', letterSpacing: -1, lineHeight: 30 },
  rawTime: { color: '#444', fontSize: 11, marginTop: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  verifiedBadge: { backgroundColor: '#0a2a0a', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, color: '#4caf50', overflow: 'hidden' },
  bracket: { color: '#333', fontSize: 10, fontWeight: '600' },

  carName: { color: '#fff', fontSize: 14, fontWeight: '800', marginBottom: 2 },
  carEngine: { color: '#555', fontSize: 11, marginBottom: 6 },

  statsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  stat: { color: '#444', fontSize: 11 },
  date: { color: '#2a2a2a', fontSize: 10, marginTop: 6, textAlign: 'right' },
});
