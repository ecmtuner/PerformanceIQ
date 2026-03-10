import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';

const CATEGORIES = [
  {
    label: 'CONNECTED TOOLS',
    color: '#e51515',
    tools: [
      { id: 'gps',   emoji: '📡', title: 'GPS Performance',  sub: 'Live speed & timing',      screen: 'DragyGPS' },
      { id: 'obd2',  emoji: '🔌', title: 'OBD2 Scanner',     sub: 'Live engine data & DTC',   screen: 'OBD2' },
    ],
    wide: true,
  },
  {
    label: 'TIMING & CORRECTION',
    color: '#ff6b35',
    tools: [
      { id: 'standing', emoji: '🚦', title: '0–60 / 0–100',    sub: 'Slope Corrector',     screen: 'StandingStart' },
      { id: 'slope',    emoji: '⏱️', title: 'Roll Race',        sub: 'Slope Corrector',     screen: 'SlopeCorrector' },
      { id: 'trap',     emoji: '🏁', title: 'Trap Speed',       sub: 'Corrector',           screen: 'TrapSpeed' },
      { id: 'reaction', emoji: '🎯', title: 'Reaction Timer',   sub: 'Christmas Tree',      screen: 'ReactionTimer' },
    ],
  },
  {
    label: 'CALCULATORS',
    color: '#4fc3f7',
    tools: [
      { id: 'da',      emoji: '🌡️', title: 'Density Altitude', sub: 'Auto GPS fill',        screen: 'DensityAltitude' },
      { id: 'weather', emoji: '🌤️', title: 'SAE Weather',      sub: 'Correction factor',   screen: 'WeatherCorrection' },
      { id: 'pw',      emoji: '⚖️', title: 'Power/Weight',     sub: 'vs Famous Cars',      screen: 'PowerWeight' },
      { id: 'speedo',  emoji: '🔢', title: 'Speedo Fix',       sub: 'Tire size change',    screen: 'SpeedoCorrection' },
      { id: 'tire',    emoji: '🏎️', title: 'Tire Speed',       sub: 'Speed per gear/RPM',  screen: 'TireSpeed' },
      { id: 'ethanol', emoji: '⛽', title: 'Ethanol Mix',      sub: 'E85 calculator',      screen: 'EthanolCalc' },
    ],
  },
  {
    label: 'MY GARAGE',
    color: '#a5d6a7',
    tools: [
      { id: 'car',     emoji: '🚗', title: 'Car Profile',      sub: 'Pre-fill calculators', screen: 'CarProfile' },
      { id: 'logbook', emoji: '📓', title: 'Run Logbook',      sub: 'Saved runs',           screen: 'RunLogbook' },
      { id: 'notes',   emoji: '📝', title: 'Tune Notes',       sub: 'Session log',          screen: 'TuneNotes' },
      { id: 'e85',     emoji: '📍', title: 'Find E85',         sub: 'Nearby stations',      screen: 'FindE85' },
    ],
  },
];

export default function HomeScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}><Text style={styles.red}>Performance</Text>IQ</Text>
          <Text style={styles.tagline}>RACE  ·  TUNE  ·  DOMINATE</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PRO</Text>
        </View>
      </View>

      {/* Categories */}
      {CATEGORIES.map((cat) => (
        <View key={cat.label} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionBar, { backgroundColor: cat.color }]} />
            <Text style={styles.sectionLabel}>{cat.label}</Text>
          </View>
          <View style={[styles.grid, cat.wide && styles.gridWide]}>
            {cat.tools.map((tool) => (
              <TouchableOpacity
                key={tool.id}
                style={[styles.card, cat.wide && styles.cardWide, { borderColor: cat.color + '22' }]}
                onPress={() => navigation.navigate(tool.screen)}
                activeOpacity={0.7}>
                <View style={[styles.iconCircle, { backgroundColor: cat.color + '18' }]}>
                  <Text style={styles.cardEmoji}>{tool.emoji}</Text>
                </View>
                <Text style={styles.cardTitle}>{tool.title}</Text>
                <Text style={styles.cardSub}>{tool.sub}</Text>
                <View style={[styles.cardAccent, { backgroundColor: cat.color }]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>ECMTuner PerformanceIQ · ecmtuner.com</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  content: { paddingHorizontal: 16, paddingBottom: 50 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Platform.OS === 'android' ? 20 : 12, paddingBottom: 24 },
  appName: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  red: { color: '#e51515' },
  tagline: { color: '#333', fontSize: 10, letterSpacing: 3, marginTop: 2, fontWeight: '600' },
  badge: { backgroundColor: '#e51515', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  sectionBar: { width: 3, height: 14, borderRadius: 2 },
  sectionLabel: { color: '#444', fontSize: 11, fontWeight: '700', letterSpacing: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridWide: {},

  card: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    width: '47.5%',
    minHeight: 115,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    position: 'relative',
  },
  cardWide: { width: '47.5%', minHeight: 130 },
  iconCircle: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardEmoji: { fontSize: 22 },
  cardTitle: { color: '#fff', fontSize: 13, fontWeight: '800', marginBottom: 3, letterSpacing: -0.3 },
  cardSub: { color: '#444', fontSize: 11, fontWeight: '500', lineHeight: 15 },
  cardAccent: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },

  footer: { alignItems: 'center', paddingTop: 8 },
  footerText: { color: '#222', fontSize: 10, letterSpacing: 1 },
});
