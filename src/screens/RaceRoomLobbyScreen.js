import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { createRoom, joinRoom } from '../services/RaceRoomService';
import { getLocalUser } from '../services/AuthService';
import { getCarProfile } from '../utils/storage';

export default function RaceRoomLobbyScreen({ navigation }) {
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [car, setCar] = useState(null);

  useEffect(() => {
    getLocalUser().then(u => setUser(u));
    getCarProfile().then(c => setCar(c));
  }, []);

  const carLabel = car?.make
    ? `${car.year || ''} ${car.make} ${car.model || ''}`.trim()
    : null;

  const handleCreate = async () => {
    if (!user) { Alert.alert('Sign In Required', 'Please sign in to create a race room.'); return; }
    setLoading(true);
    try {
      const label = carLabel || 'Unknown Car';
      const roomCode = await createRoom({
        uid: user.uid,
        username: user.username || user.email,
        car: label,
      });
      navigation.replace('RaceRoomWait', { roomCode, role: 'r1', user, carLabel: label });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || joinCode.trim().length < 4) {
      Alert.alert('Enter Code', 'Please enter the race room code.'); return;
    }
    if (!user) { Alert.alert('Sign In Required', 'Please sign in to join a race.'); return; }
    setLoading(true);
    try {
      const label = carLabel || 'Unknown Car';
      const result = await joinRoom({
        roomCode: joinCode.trim().toUpperCase(),
        uid: user.uid,
        username: user.username || user.email,
        car: label,
      });
      navigation.replace('RaceRoomWait', { roomCode: result.roomCode, role: 'r2', user, carLabel: label });
    } catch (e) {
      Alert.alert('Cannot Join', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.root} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={['#1a0000', '#000']} style={s.header}>
          <Text style={s.flag}>🏁</Text>
          <Text style={s.title}>Race Room</Text>
          <Text style={s.subtitle}>Real-time GPS roll race</Text>
        </LinearGradient>

        {/* Racer info */}
        <View style={s.card}>
          <Text style={s.label}>RACING AS</Text>
          <Text style={s.value}>{user?.username || user?.email || 'Not signed in'}</Text>
          <Text style={s.label} style={{ marginTop: 8 }}>CAR</Text>
          <Text style={s.value}>{carLabel || 'No car set'}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('CarProfile')} style={s.setCarBtn}>
            <Text style={s.setCarTxt}>{carLabel ? '✏️ Edit Car Profile' : '⚙️ Set Car Profile'}</Text>
          </TouchableOpacity>
        </View>

        {/* Mode selection */}
        {!mode && (
          <View style={s.btnRow}>
            <TouchableOpacity style={[s.bigBtn, { borderColor: '#e51515' }]} onPress={() => setMode('create')}>
              <Text style={s.bigBtnIcon}>🆕</Text>
              <Text style={s.bigBtnTxt}>Create Room</Text>
              <Text style={s.bigBtnSub}>Share code with opponent</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.bigBtn, { borderColor: '#ff8c00' }]} onPress={() => setMode('join')}>
              <Text style={s.bigBtnIcon}>🔗</Text>
              <Text style={s.bigBtnTxt}>Join Room</Text>
              <Text style={s.bigBtnSub}>Enter opponent's code</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Create flow */}
        {mode === 'create' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Create Race Room</Text>
            <Text style={s.info}>A 6-character code will be generated. Share it with your opponent so they can join.</Text>
            {loading
              ? <ActivityIndicator color="#e51515" style={{ marginTop: 20 }} />
              : <>
                  <TouchableOpacity style={s.goBtn} onPress={handleCreate}>
                    <Text style={s.goBtnTxt}>🏁 Create Room</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setMode(null)} style={s.backBtn}>
                    <Text style={s.backTxt}>← Back</Text>
                  </TouchableOpacity>
                </>
            }
          </View>
        )}

        {/* Join flow */}
        {mode === 'join' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Join Race Room</Text>
            <Text style={s.info}>Enter the code your opponent shared with you.</Text>
            <TextInput
              style={s.codeInput}
              value={joinCode}
              onChangeText={t => setJoinCode(t.toUpperCase())}
              placeholder="e.g. A3XK9P"
              placeholderTextColor="#444"
              autoCapitalize="characters"
              maxLength={6}
            />
            {loading
              ? <ActivityIndicator color="#e51515" style={{ marginTop: 20 }} />
              : <>
                  <TouchableOpacity style={s.goBtn} onPress={handleJoin}>
                    <Text style={s.goBtnTxt}>🔗 Join Room</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setMode(null)} style={s.backBtn}>
                    <Text style={s.backTxt}>← Back</Text>
                  </TouchableOpacity>
                </>
            }
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { paddingBottom: 40 },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 30 },
  flag: { fontSize: 48 },
  title: { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 8 },
  subtitle: { color: '#e51515', fontSize: 14, fontWeight: '700', marginTop: 4, letterSpacing: 1 },
  card: { backgroundColor: '#111', borderRadius: 16, margin: 16, padding: 18, borderWidth: 1, borderColor: '#1e1e1e' },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 10 },
  label: { color: '#666', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  value: { color: '#fff', fontSize: 16, fontWeight: '700' },
  info: { color: '#888', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  btnRow: { flexDirection: 'row', gap: 12, margin: 16 },
  bigBtn: { flex: 1, backgroundColor: '#111', borderRadius: 16, borderWidth: 1.5, padding: 20, alignItems: 'center' },
  bigBtnIcon: { fontSize: 32 },
  bigBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 8 },
  bigBtnSub: { color: '#666', fontSize: 11, marginTop: 4, textAlign: 'center' },
  codeInput: { backgroundColor: '#000', borderWidth: 1.5, borderColor: '#333', borderRadius: 12, padding: 16, color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: 8, marginBottom: 16 },
  goBtn: { backgroundColor: '#e51515', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  goBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '900' },
  backBtn: { alignItems: 'center', padding: 12 },
  backTxt: { color: '#666', fontSize: 14 },
  setCarBtn: { marginTop: 10, backgroundColor: '#1a1a1a', borderRadius: 8, padding: 10, alignItems: 'center' },
  setCarTxt: { color: '#e51515', fontSize: 13, fontWeight: '700' },
});
