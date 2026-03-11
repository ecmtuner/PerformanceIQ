import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { subscribeRoom, pushSpeed, markFinished, abandonRoom } from '../services/RaceRoomService';
import { LiveSpeedStore } from '../services/LiveSpeedStore';

const { width } = Dimensions.get('window');
const PHASE = { PREP: 'prep', LIGHTS: 'lights', RACING: 'racing', FINISHED: 'finished' };

export default function RaceCountdownScreen({ navigation, route }) {
  const { roomCode, role } = route.params;
  const myRole = role;
  const oppRole = role === 'r1' ? 'r2' : 'r1';

  const [room, setRoom] = useState(null);
  const [phase, setPhase] = useState(PHASE.PREP);
  const [prepCountdown, setPrepCountdown] = useState(30);
  const [lightIndex, setLightIndex] = useState(-1); // -1 = none, 0=red, 1=yellow, 2=green
  const [mySpeed, setMySpeed] = useState(0);
  const [raceStartTime, setRaceStartTime] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [finishedData, setFinishedData] = useState(null); // { winner, myElapsed, oppElapsed }

  const unsubRoomRef = useRef(null);
  const unsubSpeedRef = useRef(null);
  const timerRef = useRef(null);
  const lightTimerRef = useRef(null);
  const speedPushRef = useRef(null);
  const finishedRef = useRef(false);
  const raceStartRef = useRef(null);

  const agreedParams = room?.agreedParams;

  // ─── Subscribe to room ────────────────────────────────────────────────────
  useEffect(() => {
    unsubRoomRef.current = subscribeRoom(roomCode, (data) => {
      setRoom(data);
      if (data.status === 'abandoned') {
        cleanup();
        Alert.alert('Race Cancelled', 'The other racer left.');
        navigation.replace('RaceRoomLobby');
      }
      if (data.status === 'finished' && !finishedRef.current) {
        finishedRef.current = true;
        setPhase(PHASE.FINISHED);
        const myEl = data[myRole]?.elapsedMs;
        const oppEl = data[oppRole]?.elapsedMs;
        setFinishedData({ winner: data.winner, myElapsed: myEl, oppElapsed: oppEl });
        clearIntervals();
      }
    });
    return cleanup;
  }, []);

  // ─── Subscribe to local Dragy speed ──────────────────────────────────────
  useEffect(() => {
    unsubSpeedRef.current = LiveSpeedStore.subscribe((spd) => {
      setMySpeed(spd);
      if (phase === PHASE.RACING && raceStartRef.current) {
        const elapsed = Date.now() - raceStartRef.current;
        setElapsedMs(elapsed);
        // Push speed to Firebase (throttled via ref)
        if (speedPushRef.current && Date.now() - speedPushRef.current > 800) {
          speedPushRef.current = Date.now();
          pushSpeed(roomCode, myRole, spd).catch(() => {});
        }
        // Check if hit finish speed
        if (!finishedRef.current && agreedParams && spd >= agreedParams.finishSpeed) {
          finishedRef.current = true;
          markFinished(roomCode, myRole, elapsed).catch(() => {});
        }
      }
    });
    return () => unsubSpeedRef.current?.();
  }, [phase, agreedParams]);

  // ─── Start countdown sequence based on startTimestamp ────────────────────
  useEffect(() => {
    if (!room?.startTimestamp) return;
    const startMs = room.startTimestamp; // absolute timestamp when race starts (after lights)
    const prepEndMs = startMs - 3000;    // lights phase starts 3s before race
    const now = Date.now();

    if (now >= startMs) {
      // Already past start (re-joining) → go straight to racing
      startRacing(startMs);
      return;
    }

    // Prep phase: count down to lights
    if (phase === PHASE.PREP) {
      timerRef.current = setInterval(() => {
        const remaining = Math.ceil((prepEndMs - Date.now()) / 1000);
        if (remaining <= 0) {
          clearInterval(timerRef.current);
          startLightsSequence(startMs);
        } else {
          setPrepCountdown(Math.max(0, remaining));
        }
      }, 200);
    }

    return () => clearInterval(timerRef.current);
  }, [room?.startTimestamp]);

  const startLightsSequence = (startMs) => {
    setPhase(PHASE.LIGHTS);
    setLightIndex(0); // 🔴
    setTimeout(() => setLightIndex(1), 1000); // 🔶
    setTimeout(() => setLightIndex(2), 2000); // 🟢
    setTimeout(() => {
      startRacing(startMs);
    }, 3000);
  };

  const startRacing = (startMs) => {
    const actualStart = startMs;
    raceStartRef.current = actualStart;
    setRaceStartTime(actualStart);
    speedPushRef.current = Date.now();
    setPhase(PHASE.RACING);
    // Elapsed timer
    timerRef.current = setInterval(() => {
      if (raceStartRef.current) setElapsedMs(Date.now() - raceStartRef.current);
    }, 100);
  };

  const clearIntervals = () => {
    clearInterval(timerRef.current);
    clearInterval(lightTimerRef.current);
  };

  const cleanup = () => {
    clearIntervals();
    unsubRoomRef.current?.();
    unsubSpeedRef.current?.();
  };

  const handleLeave = () => {
    Alert.alert('Abandon Race?', 'This will end the race for both of you.', [
      { text: 'Stay' },
      { text: 'Leave', style: 'destructive', onPress: () => {
        cleanup();
        abandonRoom(roomCode, myRole).catch(() => {});
        navigation.replace('RaceRoomLobby');
      }},
    ]);
  };

  const formatTime = (ms) => {
    if (ms == null) return '—';
    return (ms / 1000).toFixed(2) + 's';
  };

  const opp = room?.[oppRole];
  const me = room?.[myRole];
  const params = room?.agreedParams;

  // ─── FINISHED SCREEN ─────────────────────────────────────────────────────
  if (phase === PHASE.FINISHED && finishedData) {
    const iWon = finishedData.winner === myRole;
    const myT = finishedData.myElapsed;
    const oppT = finishedData.oppElapsed;
    return (
      <LinearGradient colors={iWon ? ['#0a2e0a', '#000'] : ['#2e0a0a', '#000']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.resultScroll}>
          <Text style={s.resultFlag}>{iWon ? '🏆' : '💀'}</Text>
          <Text style={[s.resultTitle, { color: iWon ? '#4caf50' : '#e51515' }]}>
            {iWon ? 'YOU WIN!' : 'YOU LOSE'}
          </Text>
          <Text style={s.resultSub}>{params?.startSpeed} mph → {params?.finishSpeed} mph</Text>

          <View style={s.resultCard}>
            <View style={s.resultRow}>
              <View style={s.resultRacer}>
                <Text style={[s.resultRacerName, { color: '#e51515' }]}>YOU</Text>
                <Text style={s.resultRacerUser}>{me?.username}</Text>
                <Text style={s.resultTime}>{formatTime(myT)}</Text>
                {iWon && <Text style={s.winnerTag}>🏆 WINNER</Text>}
              </View>
              <Text style={s.resultVs}>VS</Text>
              <View style={s.resultRacer}>
                <Text style={[s.resultRacerName, { color: '#ff8c00' }]}>OPPONENT</Text>
                <Text style={s.resultRacerUser}>{opp?.username}</Text>
                <Text style={s.resultTime}>{formatTime(oppT)}</Text>
                {!iWon && <Text style={s.winnerTag}>🏆 WINNER</Text>}
              </View>
            </View>
            {myT != null && oppT != null && (
              <Text style={s.margin}>
                Margin: {Math.abs((myT - oppT) / 1000).toFixed(3)}s {iWon ? 'faster' : 'slower'}
              </Text>
            )}
          </View>

          <TouchableOpacity style={s.rematchBtn} onPress={() => navigation.replace('RaceRoomLobby')}>
            <Text style={s.rematchTxt}>🏁 Race Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.homeBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={s.homeTxt}>Go Home</Text>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    );
  }

  // ─── LIGHTS SEQUENCE ─────────────────────────────────────────────────────
  if (phase === PHASE.LIGHTS) {
    const lights = [
      { color: '#e51515', label: '🔴' },
      { color: '#ff8c00', label: '🟡' },
      { color: '#4caf50', label: '🟢' },
    ];
    return (
      <View style={[s.centeredFull, { backgroundColor: '#000' }]}>
        <View style={s.lightsContainer}>
          {lights.map((l, i) => (
            <View key={i} style={[s.light, {
              backgroundColor: i <= lightIndex ? l.color : '#1a1a1a',
              shadowColor: i <= lightIndex ? l.color : 'transparent',
              shadowOpacity: i <= lightIndex ? 0.9 : 0,
              shadowRadius: 20, elevation: i <= lightIndex ? 12 : 0,
            }]} />
          ))}
        </View>
        <Text style={s.lightsHint}>{lightIndex === 2 ? 'GO!' : 'GET READY...'}</Text>
      </View>
    );
  }

  // ─── RACING SCREEN ───────────────────────────────────────────────────────
  if (phase === PHASE.RACING) {
    const speedPct = params ? Math.min(1, Math.max(0, (mySpeed - params.startSpeed) / (params.finishSpeed - params.startSpeed))) : 0;
    const oppSpeed = opp?.speed || 0;
    const oppPct = params ? Math.min(1, Math.max(0, (oppSpeed - params.startSpeed) / (params.finishSpeed - params.startSpeed))) : 0;

    return (
      <View style={[s.centeredFull, { backgroundColor: '#000' }]}>
        <Text style={s.raceRoomCode}>{roomCode}</Text>
        <Text style={s.raceParams}>{params?.startSpeed} mph → {params?.finishSpeed} mph</Text>

        {/* My speed */}
        <View style={s.speedBlock}>
          <Text style={s.speedBlockLabel}>YOU</Text>
          <Text style={s.speedBig}>{mySpeed.toFixed(1)}</Text>
          <Text style={s.speedUnit}>mph</Text>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${speedPct * 100}%`, backgroundColor: '#e51515' }]} />
          </View>
        </View>

        {/* Divider */}
        <Text style={s.vsRace}>VS</Text>

        {/* Opponent speed */}
        <View style={s.speedBlock}>
          <Text style={[s.speedBlockLabel, { color: '#ff8c00' }]}>OPPONENT — {opp?.username}</Text>
          <Text style={[s.speedBig, { color: '#ff8c00', fontSize: 40 }]}>{oppSpeed.toFixed(1)}</Text>
          <Text style={[s.speedUnit, { color: '#ff8c00' }]}>mph</Text>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${oppPct * 100}%`, backgroundColor: '#ff8c00' }]} />
          </View>
        </View>

        <Text style={s.elapsedTime}>{formatTime(elapsedMs)}</Text>

        {LiveSpeedStore.getSpeed() === 0 && (
          <Text style={s.noGpsWarning}>⚠️ Connect Dragy GPS for live speed</Text>
        )}

        <TouchableOpacity style={s.abandonBtn} onPress={handleLeave}>
          <Text style={s.abandonTxt}>Abandon</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── PREP SCREEN (30s timer) ─────────────────────────────────────────────
  return (
    <View style={[s.centeredFull, { backgroundColor: '#000' }]}>
      <Text style={s.prepTitle}>GET TO SPEED</Text>
      <Text style={s.prepSpeed}>{params?.startSpeed || '?'} mph</Text>
      <Text style={s.prepSub}>Race starts in</Text>
      <Text style={s.prepCountdown}>{prepCountdown}</Text>
      <Text style={s.prepSub2}>Hit {params?.startSpeed} mph, then race to {params?.finishSpeed} mph</Text>
      <Text style={s.prepRoomCode}>Room: {roomCode}</Text>

      {LiveSpeedStore.getSpeed() === 0 && (
        <Text style={s.noGpsWarning}>⚠️ No live speed — connect Dragy first</Text>
      )}

      <TouchableOpacity style={s.abandonBtn} onPress={handleLeave}>
        <Text style={s.abandonTxt}>Abandon Race</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  centeredFull: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  // Prep
  prepTitle: { color: '#e51515', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  prepSpeed: { color: '#fff', fontSize: 64, fontWeight: '900', marginTop: 4 },
  prepSub: { color: '#888', fontSize: 14, marginTop: 16 },
  prepCountdown: { color: '#e51515', fontSize: 96, fontWeight: '900', lineHeight: 100 },
  prepSub2: { color: '#666', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  prepRoomCode: { color: '#333', fontSize: 12, marginTop: 16 },
  // Lights
  lightsContainer: { flexDirection: 'row', gap: 20, marginBottom: 30 },
  light: { width: 70, height: 70, borderRadius: 35 },
  lightsHint: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  // Racing
  raceRoomCode: { color: '#333', fontSize: 12, marginBottom: 4 },
  raceParams: { color: '#666', fontSize: 13, marginBottom: 20 },
  speedBlock: { alignItems: 'center', width: '100%' },
  speedBlockLabel: { color: '#e51515', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  speedBig: { color: '#fff', fontSize: 72, fontWeight: '900', lineHeight: 76 },
  speedUnit: { color: '#888', fontSize: 14, marginBottom: 8 },
  progressBar: { width: width - 60, height: 8, backgroundColor: '#1a1a1a', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  vsRace: { color: '#333', fontSize: 18, fontWeight: '900', marginVertical: 12 },
  elapsedTime: { color: '#4caf50', fontSize: 28, fontWeight: '900', marginTop: 20 },
  noGpsWarning: { color: '#ff8c00', fontSize: 12, marginTop: 12 },
  abandonBtn: { position: 'absolute', bottom: 30, right: 20 },
  abandonTxt: { color: '#333', fontSize: 12 },
  // Result
  resultScroll: { alignItems: 'center', paddingTop: 80, paddingBottom: 40, paddingHorizontal: 20 },
  resultFlag: { fontSize: 72 },
  resultTitle: { fontSize: 44, fontWeight: '900', marginTop: 8 },
  resultSub: { color: '#888', fontSize: 14, marginTop: 4, marginBottom: 24 },
  resultCard: { backgroundColor: '#111', borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: '#1e1e1e' },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultRacer: { flex: 1, alignItems: 'center' },
  resultRacerName: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  resultRacerUser: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 4 },
  resultTime: { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 8 },
  winnerTag: { color: '#4caf50', fontSize: 12, fontWeight: '900', marginTop: 6 },
  resultVs: { color: '#333', fontSize: 16, fontWeight: '900' },
  margin: { color: '#888', fontSize: 13, textAlign: 'center', marginTop: 16 },
  rematchBtn: { backgroundColor: '#e51515', borderRadius: 14, padding: 18, width: '100%', alignItems: 'center', marginTop: 24 },
  rematchTxt: { color: '#fff', fontSize: 18, fontWeight: '900' },
  homeBtn: { alignItems: 'center', padding: 16 },
  homeTxt: { color: '#444', fontSize: 14 },
});
