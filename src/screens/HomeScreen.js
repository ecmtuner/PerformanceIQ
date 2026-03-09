import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

const TOOLS = [
  { id: 'slope',    emoji: '⏱️', title: 'Roll Race',         sub: 'Slope Corrector',     screen: 'SlopeCorrector' },
  { id: 'standing', emoji: '🚦', title: '0-60 / 0-100',      sub: 'Slope Corrector',     screen: 'StandingStart' },
  { id: 'trap',     emoji: '🏁', title: 'Trap Speed',        sub: 'Corrector',           screen: 'TrapSpeed' },
  { id: 'da',       emoji: '🌡️', title: 'Density Altitude',  sub: 'Calculator',          screen: 'DensityAltitude' },
  { id: 'weather',  emoji: '🌤️', title: 'SAE Weather',       sub: 'Correction',          screen: 'WeatherCorrection' },
  { id: 'pw',       emoji: '⚖️', title: 'Power-to-Weight',   sub: 'vs Famous Cars',      screen: 'PowerWeight' },
  { id: 'speedo',   emoji: '🔢', title: 'Speedo Correction', sub: 'Tire Size Change',    screen: 'SpeedoCorrection' },
  { id: 'tire',     emoji: '🏎️', title: 'Tire Speed',        sub: 'Speed per Gear',      screen: 'TireSpeed' },
  { id: 'reaction', emoji: '🎯', title: 'Reaction Timer',    sub: 'Christmas Tree',      screen: 'ReactionTimer' },
  { id: 'logbook',  emoji: '📓', title: 'Run Logbook',       sub: 'Saved runs',          screen: 'RunLogbook' },
  { id: 'notes',    emoji: '📝', title: 'Tune Notes',        sub: 'Session log',         screen: 'TuneNotes' },
  { id: 'car',      emoji: '🚗', title: 'Car Profile',       sub: 'Pre-fill calculators', screen: 'CarProfile' },
  { id: 'obd2',     emoji: '🔌', title: 'OBD2 Scanner',      sub: 'Live vehicle data',    screen: 'OBD2' },
  { id: 'dragy',    emoji: '📡', title: 'Dragy GPS',          sub: 'Performance meter',    screen: 'DragyGPS' },
];

export default function HomeScreen({ navigation }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.appName}><Text style={styles.red}>Performance</Text>IQ</Text>
      <Text style={styles.tagline}>Race. Tune. Dominate.</Text>
      <View style={styles.grid}>
        {TOOLS.map((tool) => (
          <TouchableOpacity key={tool.id} style={styles.card} onPress={() => navigation.navigate(tool.screen)} activeOpacity={0.75}>
            <Text style={styles.cardEmoji}>{tool.emoji}</Text>
            <Text style={styles.cardTitle}>{tool.title}</Text>
            <Text style={styles.cardSub}>{tool.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, paddingBottom: 40 },
  appName: { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 12, marginBottom: 4 },
  red: { color: '#e51515' },
  tagline: { color: '#444', fontSize: 13, marginBottom: 24, letterSpacing: 2, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 14, padding: 16, width: '47%', minHeight: 110, justifyContent: 'center' },
  cardEmoji: { fontSize: 28, marginBottom: 8 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '800', marginBottom: 2 },
  cardSub: { color: '#555', fontSize: 11, fontWeight: '500' },
});
