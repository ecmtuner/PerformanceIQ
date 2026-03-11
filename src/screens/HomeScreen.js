import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getLocalUser, signOut } from '../services/AuthService';

const CATEGORIES = [
  {
    label: 'CONNECTED TOOLS',
    accent: '#e51515',
    tools: [
      { id: 'gps',  emoji: '📡', title: 'GPS Performance',  sub: 'Live speed & timing',    screen: 'DragyGPS' },
      { id: 'obd2', emoji: '🔌', title: 'OBD2 Scanner',     sub: 'Live engine data & DTC',  screen: 'OBD2' },
    ],
  },
  {
    label: 'TIMING & CORRECTION',
    accent: '#ff6b35',
    tools: [
      { id: 'standing', emoji: '🚦', title: '0–60 / 0–100',    sub: 'Slope corrected',     screen: 'StandingStart' },
      { id: 'slope',    emoji: '⏱️', title: 'Roll Race',        sub: 'Slope corrected',     screen: 'SlopeCorrector' },
      { id: 'trap',     emoji: '🏁', title: 'Trap Speed',       sub: 'Corrected 1/4 mile',  screen: 'TrapSpeed' },
      { id: 'reaction', emoji: '🎯', title: 'Reaction Timer',   sub: 'Launch training',     screen: 'ReactionTimer' },
    ],
  },
  {
    label: 'CALCULATORS',
    accent: '#4fc3f7',
    tools: [
      { id: 'da',      emoji: '🌡️', title: 'Density Altitude', sub: 'Auto GPS fill',       screen: 'DensityAltitude' },
      { id: 'weather', emoji: '🌤️', title: 'SAE Weather',      sub: 'Correction factor',   screen: 'WeatherCorrection' },
      { id: 'pw',      emoji: '⚖️', title: 'Power / Weight',   sub: 'vs Famous Cars',      screen: 'PowerWeight' },
      { id: 'speedo',  emoji: '🔢', title: 'Speedo Correction', sub: 'Tire size change',   screen: 'SpeedoCorrection' },
      { id: 'tire',    emoji: '🏎️', title: 'Tire Speed',       sub: 'Speed per gear/RPM',  screen: 'TireSpeed' },
      { id: 'ethanol', emoji: '⛽', title: 'Ethanol Mix',      sub: 'E85 blend ratio',     screen: 'EthanolCalc' },
    ],
  },
  {
    label: 'COMMUNITY',
    accent: '#ffd740',
    tools: [
      { id: 'leaderboard', emoji: '🏆', title: 'Leaderboard',   sub: 'Global run rankings',   screen: 'Leaderboard' },
    ],
  },
  {
    label: 'MY GARAGE',
    accent: '#69f0ae',
    tools: [
      { id: 'car',     emoji: '🚗', title: 'Car Profile',      sub: 'Pre-fill calculators', screen: 'CarProfile' },
      { id: 'logbook', emoji: '📓', title: 'Run Logbook',      sub: 'Saved runs',           screen: 'RunLogbook' },
      { id: 'notes',   emoji: '📝', title: 'Tune Notes',       sub: 'Session log',          screen: 'TuneNotes' },
      { id: 'e85',     emoji: '📍', title: 'Find E85',         sub: 'Nearest stations',     screen: 'FindE85' },
    ],
  },
];

export default function HomeScreen({ navigation }) {
  const [username, setUsername] = useState('');
  useEffect(() => { getLocalUser().then(u => setUsername(u?.username || u?.email || '')); }, []);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await signOut();
        // Reload app by navigating — App.js will detect no user and show AuthScreen
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      }},
    ]);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.wordmark}>
                <Text style={styles.wordmarkRed}>Performance</Text>IQ
              </Text>
              <Text style={styles.tagline}>RACE  ·  TUNE  ·  DOMINATE</Text>
            </View>
            <TouchableOpacity style={styles.profileBtn} onPress={handleLogout}>
              <Text style={styles.profileEmoji}>👤</Text>
              <Text style={styles.profileName} numberOfLines={1}>{username}</Text>
              <Text style={styles.logoutHint}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Categories */}
        {CATEGORIES.map((cat) => (
          <View key={cat.label} style={styles.section}>
            {/* Section header */}
            <View style={styles.sectionHead}>
              <View style={[styles.sectionPill, { backgroundColor: cat.accent }]} />
              <Text style={styles.sectionLabel}>{cat.label}</Text>
            </View>

            {/* Cards grid */}
            <View style={styles.grid}>
              {cat.tools.map((tool) => (
                <TouchableOpacity
                  key={tool.id}
                  style={styles.cardWrap}
                  onPress={() => navigation.navigate(tool.screen)}
                  activeOpacity={0.65}>
                  <LinearGradient
                    colors={['#161616', '#0e0e0e']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.card}>
                    {/* Top accent line */}
                    <View style={[styles.topAccent, { backgroundColor: cat.accent }]} />
                    {/* Icon */}
                    <View style={[styles.iconWrap, { borderColor: cat.accent + '30' }]}>
                      <Text style={styles.emoji}>{tool.emoji}</Text>
                    </View>
                    {/* Text */}
                    <Text style={styles.cardTitle}>{tool.title}</Text>
                    <Text style={styles.cardSub}>{tool.sub}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.footerText}>ECMTuner · PerformanceIQ</Text>
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  content: { paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 24 : 12 },

  header: { marginBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  profileBtn: { alignItems: 'center', backgroundColor: '#111', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#1e1e1e', minWidth: 70 },
  profileEmoji: { fontSize: 20 },
  profileName: { color: '#aaa', fontSize: 10, fontWeight: '700', marginTop: 2, maxWidth: 70 },
  logoutHint: { color: '#e51515', fontSize: 9, fontWeight: '700', marginTop: 2 },
  wordmark: { color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: -1.5 },
  wordmarkRed: { color: '#e51515' },
  tagline: { color: '#2a2a2a', fontSize: 10, letterSpacing: 4, fontWeight: '700', marginTop: 4 },

  section: { marginBottom: 30 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionPill: { width: 4, height: 16, borderRadius: 2 },
  sectionLabel: { color: '#3a3a3a', fontSize: 10, fontWeight: '800', letterSpacing: 2.5 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cardWrap: { width: '47.5%' },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1c1c1c',
    padding: 16,
    paddingTop: 12,
    minHeight: 118,
    overflow: 'hidden',
  },
  topAccent: { height: 2, borderRadius: 1, marginBottom: 12, width: 28 },
  iconWrap: {
    width: 42, height: 42, borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0a0a0a',
    marginBottom: 10,
  },
  emoji: { fontSize: 20 },
  cardTitle: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: -0.3, marginBottom: 3 },
  cardSub: { color: '#3a3a3a', fontSize: 11, fontWeight: '500', lineHeight: 14 },

  footerText: { textAlign: 'center', color: '#1e1e1e', fontSize: 10, letterSpacing: 1.5, marginTop: 8 },
});
