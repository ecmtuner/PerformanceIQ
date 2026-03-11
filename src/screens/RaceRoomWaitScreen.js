import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { subscribeRoom, proposeParams, acceptParams, setReady, abandonRoom } from '../services/RaceRoomService';

export default function RaceRoomWaitScreen({ navigation, route }) {
  const { roomCode, role, user, carLabel } = route.params;
  const [room, setRoom] = useState(null);
  const [proposing, setProposing] = useState(false);
  const [inputStart, setInputStart] = useState('60');
  const [inputFinish, setInputFinish] = useState('140');
  const [busy, setBusy] = useState(false);
  const unsubRef = useRef(null);
  const navigatedRef = useRef(false);

  const myRole = role;           // 'r1' | 'r2'
  const oppRole = role === 'r1' ? 'r2' : 'r1';

  useEffect(() => {
    unsubRef.current = subscribeRoom(roomCode, (data) => {
      setRoom(data);
      // When countdown starts → navigate to race screen
      if ((data.status === 'countdown' || data.status === 'racing') && !navigatedRef.current) {
        navigatedRef.current = true;
        navigation.replace('RaceCountdown', { roomCode, role: myRole, room: data });
      }
      if (data.status === 'abandoned' && !navigatedRef.current) {
        navigatedRef.current = true;
        Alert.alert('Race Cancelled', 'The other racer left the room.');
        navigation.replace('RaceRoomLobby');
      }
    });
    return () => unsubRef.current?.();
  }, []);

  const me = room?.[myRole];
  const opp = room?.[oppRole];
  const proposed = room?.proposedParams;
  const agreed = room?.agreedParams;
  const iProposed = proposed?.proposedBy === myRole;
  const bothHere = room?.r1 && room?.r2;

  const handlePropose = async () => {
    const start = parseFloat(inputStart);
    const finish = parseFloat(inputFinish);
    if (isNaN(start) || isNaN(finish)) { Alert.alert('Invalid', 'Enter valid speeds.'); return; }
    if (finish <= start) { Alert.alert('Invalid', 'Finish speed must be higher than start speed.'); return; }
    if (start < 10 || finish > 250) { Alert.alert('Invalid', 'Speeds must be between 10 and 250 mph.'); return; }
    setBusy(true);
    try {
      await proposeParams(roomCode, { startSpeed: start, finishSpeed: finish, proposedBy: myRole });
      setProposing(false);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setBusy(false); }
  };

  const handleAccept = async () => {
    setBusy(true);
    try { await acceptParams(roomCode); }
    catch (e) { Alert.alert('Error', e.message); }
    finally { setBusy(false); }
  };

  const handleReady = async () => {
    if (!agreed) { Alert.alert('Agree on speeds first', 'Both racers must agree on the race speeds before readying up.'); return; }
    setBusy(true);
    try { await setReady(roomCode, myRole); }
    catch (e) { Alert.alert('Error', e.message); }
    finally { setBusy(false); }
  };

  const handleLeave = () => {
    Alert.alert('Leave Race?', 'This will cancel the race room.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        await abandonRoom(roomCode, myRole);
        navigation.replace('RaceRoomLobby');
      }},
    ]);
  };

  if (!room) return (
    <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color="#e51515" size="large" />
      <Text style={s.loadingTxt}>Connecting to room...</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={s.header}>
          <Text style={s.roomCodeLabel}>ROOM CODE</Text>
          <Text style={s.roomCode}>{roomCode}</Text>
          <Text style={s.shareHint}>Share this code with your opponent</Text>
        </View>

        {/* Racers */}
        <View style={s.racersRow}>
          <View style={[s.racerCard, { borderColor: '#e51515' }]}>
            <Text style={s.racerTag}>YOU</Text>
            <Text style={s.racerName}>{me?.username || '—'}</Text>
            <Text style={s.racerCar}>{me?.car || '—'}</Text>
            <View style={[s.readyBadge, me?.ready && s.readyBadgeOn]}>
              <Text style={s.readyBadgeTxt}>{me?.ready ? '✅ READY' : '⏳ NOT READY'}</Text>
            </View>
          </View>
          <Text style={s.vs}>VS</Text>
          <View style={[s.racerCard, { borderColor: '#ff8c00' }]}>
            <Text style={[s.racerTag, { color: '#ff8c00' }]}>OPPONENT</Text>
            {opp
              ? <>
                  <Text style={s.racerName}>{opp.username || '—'}</Text>
                  <Text style={s.racerCar}>{opp.car || '—'}</Text>
                  <View style={[s.readyBadge, opp.ready && s.readyBadgeOn]}>
                    <Text style={s.readyBadgeTxt}>{opp.ready ? '✅ READY' : '⏳ NOT READY'}</Text>
                  </View>
                </>
              : <Text style={s.waiting}>⏳ Waiting for opponent...</Text>
            }
          </View>
        </View>

        {/* Speed negotiation */}
        <View style={s.card}>
          <Text style={s.cardTitle}>⚡ Race Parameters</Text>

          {/* Current proposal */}
          {agreed ? (
            <View style={s.agreedBox}>
              <Text style={s.agreedLabel}>✅ BOTH AGREED</Text>
              <Text style={s.agreedSpeed}>{agreed.startSpeed} mph → {agreed.finishSpeed} mph</Text>
            </View>
          ) : proposed ? (
            <View style={s.proposalBox}>
              <Text style={s.proposalLabel}>{iProposed ? 'YOUR PROPOSAL' : 'OPPONENT\'S PROPOSAL'}</Text>
              <Text style={s.proposalSpeed}>{proposed.startSpeed} mph → {proposed.finishSpeed} mph</Text>
              {!iProposed && (
                <View style={s.proposalBtns}>
                  <TouchableOpacity style={s.acceptBtn} onPress={handleAccept} disabled={busy}>
                    <Text style={s.acceptBtnTxt}>✅ Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.counterBtn} onPress={() => {
                    setInputStart(String(proposed.startSpeed));
                    setInputFinish(String(proposed.finishSpeed));
                    setProposing(true);
                  }}>
                    <Text style={s.counterBtnTxt}>🔄 Counter</Text>
                  </TouchableOpacity>
                </View>
              )}
              {iProposed && <Text style={s.waitingTxt}>Waiting for opponent to accept or counter...</Text>}
            </View>
          ) : (
            <Text style={s.noProposal}>No race speeds proposed yet.</Text>
          )}

          {/* Propose / Edit form */}
          {(proposing || !proposed) && (
            <View style={s.proposeForm}>
              <Text style={s.formLabel}>{proposed ? 'Counter Proposal' : 'Propose Race Speeds'}</Text>
              <View style={s.speedRow}>
                <View style={s.speedInput}>
                  <Text style={s.speedInputLabel}>START SPEED (mph)</Text>
                  <TextInput
                    style={s.speedField}
                    value={inputStart}
                    onChangeText={setInputStart}
                    keyboardType="numeric"
                    placeholder="e.g. 60"
                    placeholderTextColor="#444"
                    maxLength={3}
                  />
                </View>
                <Text style={s.arrow}>→</Text>
                <View style={s.speedInput}>
                  <Text style={s.speedInputLabel}>FINISH SPEED (mph)</Text>
                  <TextInput
                    style={s.speedField}
                    value={inputFinish}
                    onChangeText={setInputFinish}
                    keyboardType="numeric"
                    placeholder="e.g. 140"
                    placeholderTextColor="#444"
                    maxLength={3}
                  />
                </View>
              </View>
              <TouchableOpacity style={s.proposeBtn} onPress={handlePropose} disabled={busy || !bothHere}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.proposeBtnTxt}>📤 {proposed ? 'Send Counter' : 'Propose Speeds'}</Text>}
              </TouchableOpacity>
              {!bothHere && <Text style={s.waitingTxt}>Waiting for opponent to join before proposing...</Text>}
            </View>
          )}
        </View>

        {/* Ready button */}
        {agreed && (
          <View style={s.card}>
            <Text style={s.cardTitle}>🚦 Ready Up</Text>
            <Text style={s.readyInfo}>
              Once both racers hit Ready, a 30-second prep timer starts. Get to {agreed.startSpeed} mph, then race to {agreed.finishSpeed} mph!
            </Text>
            <TouchableOpacity
              style={[s.readyBtn, me?.ready && s.readyBtnDone]}
              onPress={handleReady}
              disabled={me?.ready || busy}
            >
              <Text style={s.readyBtnTxt}>{me?.ready ? '✅ Ready!' : '🟢 I\'m Ready'}</Text>
            </TouchableOpacity>
            {me?.ready && !opp?.ready && <Text style={s.waitingTxt}>Waiting for opponent...</Text>}
          </View>
        )}

        {/* Leave */}
        <TouchableOpacity style={s.leaveBtn} onPress={handleLeave}>
          <Text style={s.leaveTxt}>🚪 Leave Room</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingTxt: { color: '#666', marginTop: 12 },
  header: { alignItems: 'center', paddingTop: 50, paddingBottom: 24, backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: '#1e1e1e' },
  roomCodeLabel: { color: '#666', fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  roomCode: { color: '#e51515', fontSize: 48, fontWeight: '900', letterSpacing: 8, marginTop: 4 },
  shareHint: { color: '#555', fontSize: 12, marginTop: 4 },
  racersRow: { flexDirection: 'row', alignItems: 'center', margin: 16, gap: 8 },
  racerCard: { flex: 1, backgroundColor: '#111', borderRadius: 14, borderWidth: 1.5, padding: 14 },
  racerTag: { color: '#e51515', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  racerName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  racerCar: { color: '#888', fontSize: 11, marginTop: 2 },
  waiting: { color: '#444', fontSize: 12, marginTop: 8 },
  readyBadge: { marginTop: 8, backgroundColor: '#1a1a1a', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8, alignSelf: 'flex-start' },
  readyBadgeOn: { backgroundColor: '#0d2e0d' },
  readyBadgeTxt: { color: '#888', fontSize: 10, fontWeight: '700' },
  vs: { color: '#333', fontSize: 20, fontWeight: '900' },
  card: { backgroundColor: '#111', borderRadius: 16, margin: 16, marginTop: 0, padding: 18, borderWidth: 1, borderColor: '#1e1e1e' },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  agreedBox: { backgroundColor: '#0d2e0d', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  agreedLabel: { color: '#4caf50', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  agreedSpeed: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 4 },
  proposalBox: { backgroundColor: '#1a1400', borderRadius: 12, borderWidth: 1, borderColor: '#ff8c00', padding: 16, marginBottom: 12 },
  proposalLabel: { color: '#ff8c00', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  proposalSpeed: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 4 },
  proposalBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  acceptBtn: { flex: 1, backgroundColor: '#1a3a1a', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#4caf50' },
  acceptBtnTxt: { color: '#4caf50', fontWeight: '800', fontSize: 14 },
  counterBtn: { flex: 1, backgroundColor: '#1a1a00', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ff8c00' },
  counterBtnTxt: { color: '#ff8c00', fontWeight: '800', fontSize: 14 },
  noProposal: { color: '#555', fontSize: 13, marginBottom: 16 },
  proposeForm: { marginTop: 8 },
  formLabel: { color: '#aaa', fontSize: 13, fontWeight: '700', marginBottom: 12 },
  speedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  speedInput: { flex: 1 },
  speedInputLabel: { color: '#666', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  speedField: { backgroundColor: '#000', borderWidth: 1.5, borderColor: '#333', borderRadius: 10, padding: 14, color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  arrow: { color: '#e51515', fontSize: 22, fontWeight: '900' },
  proposeBtn: { backgroundColor: '#e51515', borderRadius: 12, padding: 14, alignItems: 'center' },
  proposeBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '900' },
  waitingTxt: { color: '#555', fontSize: 12, textAlign: 'center', marginTop: 10 },
  readyInfo: { color: '#888', fontSize: 13, lineHeight: 20, marginBottom: 14 },
  readyBtn: { backgroundColor: '#1a3a1a', borderRadius: 12, borderWidth: 1.5, borderColor: '#4caf50', padding: 16, alignItems: 'center' },
  readyBtnDone: { backgroundColor: '#0d2e0d', borderColor: '#2e7d32' },
  readyBtnTxt: { color: '#4caf50', fontSize: 18, fontWeight: '900' },
  leaveBtn: { alignItems: 'center', padding: 20 },
  leaveTxt: { color: '#333', fontSize: 14 },
});
