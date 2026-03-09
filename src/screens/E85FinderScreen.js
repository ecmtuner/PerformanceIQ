import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Linking, Platform,
} from 'react-native';
import * as Location from 'expo-location';

const NREL_API_KEY = 'dsgGHptNCc5VrdA136IpuG25QAaYFIxcoo8NRst5';
const NREL_URL = 'https://developer.nrel.gov/api/alt-fuel-stations/v1.json';

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function E85FinderScreen() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  const findStations = async () => {
    setLoading(true);
    setError(null);
    setStations([]);
    setDebugInfo(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Please enable it in Settings.');
        setLoading(false);
        return;
      }

      // Use HIGH accuracy GPS
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 0,
      });

      const { latitude, longitude, accuracy } = loc.coords;
      setUserLocation({ latitude, longitude });
      setDebugInfo(`GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)} (±${Math.round(accuracy)}m)`);

      const params = new URLSearchParams({
        api_key: NREL_API_KEY,
        fuel_type: 'E85',
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
        radius: '50.0',
        limit: '50',
        status: 'E',
        access: 'public',
      });

      const url = `${NREL_URL}?${params}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.fuel_stations || data.fuel_stations.length === 0) {
        // Try without status filter as fallback
        const params2 = new URLSearchParams({
          api_key: NREL_API_KEY,
          fuel_type: 'E85',
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
          radius: '100.0',
          limit: '50',
        });
        const res2 = await fetch(`${NREL_URL}?${params2}`);
        const data2 = await res2.json();

        if (!data2.fuel_stations || data2.fuel_stations.length === 0) {
          setError('No E85 stations found within 100 miles of your location.');
          setLoading(false);
          return;
        }

        const withDist = data2.fuel_stations
          .map((s) => ({ ...s, distance: haversineDistance(latitude, longitude, s.latitude, s.longitude) }))
          .sort((a, b) => a.distance - b.distance);
        setStations(withDist);
      } else {
        const withDist = data.fuel_stations
          .map((s) => ({ ...s, distance: haversineDistance(latitude, longitude, s.latitude, s.longitude) }))
          .sort((a, b) => a.distance - b.distance);
        setStations(withDist);
      }
    } catch (e) {
      setError(`Error: ${e.message}`);
    }

    setLoading(false);
  };

  const openMaps = (station) => {
    const lat = station.latitude;
    const lng = station.longitude;
    const label = encodeURIComponent(station.station_name);
    const url = Platform.OS === 'ios'
      ? `maps://?q=${label}&ll=${lat},${lng}`
      : `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`)
    );
  };

  const StationCard = ({ station }) => (
    <TouchableOpacity style={styles.stationCard} onPress={() => openMaps(station)}>
      <View style={styles.stationHeader}>
        <Text style={styles.stationName} numberOfLines={1}>{station.station_name}</Text>
        <Text style={styles.distance}>{station.distance.toFixed(1)} mi</Text>
      </View>
      <Text style={styles.address} numberOfLines={2}>
        {station.street_address}, {station.city}, {station.state} {station.zip}
      </Text>
      {station.e85_blender_pump && (
        <Text style={styles.badge}>⚡ Blender Pump</Text>
      )}
      <Text style={styles.tapHint}>Tap to open in Maps →</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>E85</Text>
      <Text style={styles.subtitle}>Station Finder</Text>

      <TouchableOpacity style={styles.findBtn} onPress={findStations} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.findBtnText}>📍  FIND NEAR ME</Text>
        }
      </TouchableOpacity>

      {debugInfo && (
        <Text style={styles.debugText}>{debugInfo}</Text>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {stations.length > 0 && (
        <Text style={styles.resultsLabel}>{stations.length} E85 stations found nearby</Text>
      )}

      <FlatList
        data={stations}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <StationCard station={item} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16 },
  title: { color: '#e51515', fontSize: 28, fontWeight: '800', marginTop: 12 },
  subtitle: { color: '#ffffff', fontSize: 18, fontWeight: '600', marginBottom: 20 },
  findBtn: { backgroundColor: '#e51515', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 10, minHeight: 52, justifyContent: 'center' },
  findBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 1 },
  debugText: { color: '#444', fontSize: 11, textAlign: 'center', marginBottom: 8 },
  errorBox: { backgroundColor: '#1a0a00', borderWidth: 1, borderColor: '#aa4400', borderRadius: 10, padding: 14, marginBottom: 14 },
  errorText: { color: '#ff6633', fontSize: 14 },
  resultsLabel: { color: '#666', fontSize: 13, marginBottom: 10, textAlign: 'center' },
  stationCard: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  stationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  stationName: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  distance: { color: '#e51515', fontSize: 16, fontWeight: '800' },
  address: { color: '#888', fontSize: 13, marginBottom: 6 },
  badge: { color: '#4caf50', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  tapHint: { color: '#444', fontSize: 11, marginTop: 4 },
});
