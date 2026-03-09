import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

const STATES = { IDLE: 'idle', ARMING: 'arming', WAIT: 'wait', GO: 'go', RESULT: 'result', EARLY: 'early' };
const LIGHTS = [1, 2, 3, 4, 5];

export default function ReactionTimerScreen() {
  const [state, setState] = useState(STATES.IDLE);
  const [activeLights, setActiveLights] = useState(0);
  const [reactionTime, setReactionTime] = useState(null);
  const [history, setHistory] = useState([]);
  const startRef = useRef(null);
  const timeoutRef = useRef(null);
  const lightRef = useRef(null);

  useEffect(() => () => { clearTimeout(timeoutRef.current); clearTimeout(lightRef.current); }, []);

  const start = () => {
    setState(STATES.ARMING);
    setActiveLights(0);
    setReactionTime(null);

    // Light up 5 bulbs one by one, 500ms apart
    let count = 0;
    const lightUp = () => {
      count++;
      setActiveLights(count);
      if (count < 5) {
        lightRef.current = setTimeout(lightUp, 500);
      } else {
        // Random delay 0.5–2.5s after last light, then GO
        const delay = 500 + Math.random() * 2000;
        timeoutRef.current = setTimeout(() => {
          setActiveLights(0); // all lights off = GO
          setState(STATES.GO);
          startRef.current = Date.now();
        }, delay);
      }
    };
    lightRef.current = setTimeout(lightUp, 400);
  };

  const handlePress = () => {
    if (state === STATES.IDLE || state === STATES.RESULT || state === STATES.EARLY) {
      start();
      return;
    }
    if (state === STATES.ARMING || state === STATES.WAIT) {
      // Too early!
      clearTimeout(timeoutRef.current);
      clearTimeout(lightRef.current);
      setState(STATES.EARLY);
      setActiveLights(0);
      return;
    }
    if (state === STATES.GO) {
      const rt = Date.now() - startRef.current;
      setReactionTime(rt);
      setState(STATES.RESULT);
      setHistory(h => [rt, ...h].slice(0, 8));
    }
  };

  const getBgColor = () => {
    if (state === STATES.GO) return '#003300';
    if (state === STATES.EARLY) return '#1a0000';
    return '#0a0a0a';
  };

  const getRating = (ms) => {
    if (ms < 150) return { text: '🔥 Pro level!', color: '#4caf50' };
    if (ms < 200) return { text: '⚡ Excellent', color: '#8bc34a' };
    if (ms < 250) return { text: '✅ Good', color: '#ffeb3b' };
    if (ms < 350) return { text: '👍 Average', color: '#ff9800' };
    return { text: '🐢 Keep practicing', color: '#e51515' };
  };

  const avg = history.length ? Math.round(history.reduce((a, b) => a + b, 0) / history.length) : null;

  return (
    <TouchableOpacity style={[styles.container, { backgroundColor: getBgColor() }]} onPress={handlePress} activeOpacity={1}>
      <Text style={styles.title}>Reaction Timer</Text>

      {/* Christmas tree lights */}
      <View style={styles.lightsRow}>
        {LIGHTS.map(n => (
          <View key={n} style={[styles.light, n <= activeLights && styles.lightOn]} />
        ))}
      </View>

      {state === STATES.IDLE && (
        <View style={styles.center}>
          <Text style={styles.tapToStart}>TAP TO START</Text>
          <Text style={styles.instruction}>Wait for all lights to go out, then tap as fast as you can</Text>
        </View>
      )}

      {(state === STATES.ARMING) && (
        <View style={styles.center}>
          <Text style={styles.waiting}>Get ready...</Text>
        </View>
      )}

      {state === STATES.GO && (
        <View style={styles.center}>
          <Text style={styles.goText}>GO!</Text>
          <Text style={styles.tapNow}>TAP NOW!</Text>
        </View>
      )}

      {state === STATES.EARLY && (
        <View style={styles.center}>
          <Text style={styles.earlyText}>TOO EARLY! 🔴</Text>
          <Text style={styles.instruction}>Tap to try again</Text>
        </View>
      )}

      {state === STATES.RESULT && reactionTime && (
        <View style={styles.center}>
          <Text style={styles.resultLabel}>Reaction Time</Text>
          <Text style={styles.resultValue}>{reactionTime} ms</Text>
          <Text style={[styles.rating, { color: getRating(reactionTime).color }]}>{getRating(reactionTime).text}</Text>
          <Text style={styles.tapAgain}>Tap to go again</Text>
        </View>
      )}

      {history.length > 1 && (
        <View style={styles.historyBox}>
          <Text style={styles.historyTitle}>Last {history.length} runs · Avg: {avg}ms</Text>
          <View style={styles.historyRow}>
            {history.map((t, i) => (
              <Text key={i} style={[styles.historyItem, i === 0 && styles.historyLatest]}>{t}ms</Text>
            ))}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'flex-start' },
  title: { color: '#e51515', fontSize: 28, fontWeight: '800', marginTop: 12, marginBottom: 30 },
  lightsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 40 },
  light: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#222', borderWidth: 2, borderColor: '#333' },
  lightOn: { backgroundColor: '#e51515', borderColor: '#ff4444', shadowColor: '#e51515', shadowRadius: 8, shadowOpacity: 0.8, elevation: 8 },
  center: { alignItems: 'center', paddingHorizontal: 20 },
  tapToStart: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 3, marginBottom: 12 },
  instruction: { color: '#555', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  waiting: { color: '#ff9800', fontSize: 24, fontWeight: '800' },
  goText: { color: '#4caf50', fontSize: 72, fontWeight: '900' },
  tapNow: { color: '#4caf50', fontSize: 22, fontWeight: '800', letterSpacing: 2 },
  earlyText: { color: '#e51515', fontSize: 32, fontWeight: '900', marginBottom: 12 },
  resultLabel: { color: '#aaa', fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 },
  resultValue: { color: '#fff', fontSize: 64, fontWeight: '900', marginBottom: 8 },
  rating: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
  tapAgain: { color: '#444', fontSize: 14 },
  historyBox: { position: 'absolute', bottom: 40, left: 16, right: 16, backgroundColor: '#111', borderRadius: 12, padding: 14 },
  historyTitle: { color: '#555', fontSize: 12, marginBottom: 8 },
  historyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyItem: { color: '#666', fontSize: 13 },
  historyLatest: { color: '#fff', fontWeight: '700' },
});
