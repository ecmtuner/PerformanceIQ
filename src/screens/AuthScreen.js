import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { registerUser, loginUser } from '../services/AuthService';

export default function AuthScreen({ onAuthSuccess }) {
  const [mode, setMode] = useState('register'); // 'register' | 'login'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const isRegister = mode === 'register';

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required', 'Please fill in all fields.'); return;
    }
    if (isRegister) {
      if (!username.trim()) { Alert.alert('Required', 'Please enter a username.'); return; }
      if (password !== confirm) { Alert.alert('Mismatch', 'Passwords do not match.'); return; }
      if (password.length < 6) { Alert.alert('Weak Password', 'Password must be at least 6 characters.'); return; }
    }
    setLoading(true);
    const res = isRegister
      ? await registerUser(email, password, username)
      : await loginUser(email, password);
    setLoading(false);
    if (res.success) {
      onAuthSuccess(res.user);
    } else {
      Alert.alert(isRegister ? 'Registration Failed' : 'Sign In Failed', res.error);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.root} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={['#1a0000', '#000']} style={s.header}>
          <Text style={s.logo}>⚡ PerformanceIQ</Text>
          <Text style={s.tagline}>The tuner's data platform</Text>
        </LinearGradient>

        <View style={s.card}>
          {/* Mode toggle */}
          <View style={s.tabRow}>
            <TouchableOpacity
              style={[s.tab, mode === 'register' && s.tabActive]}
              onPress={() => setMode('register')}>
              <Text style={[s.tabTxt, mode === 'register' && s.tabTxtActive]}>Create Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, mode === 'login' && s.tabActive]}
              onPress={() => setMode('login')}>
              <Text style={[s.tabTxt, mode === 'login' && s.tabTxtActive]}>Sign In</Text>
            </TouchableOpacity>
          </View>

          {isRegister && (
            <View style={s.field}>
              <Text style={s.label}>USERNAME</Text>
              <TextInput
                style={s.input}
                value={username}
                onChangeText={setUsername}
                placeholder="e.g. BoostedSergey"
                placeholderTextColor="#444"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          <View style={s.field}>
            <Text style={s.label}>EMAIL</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#444"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>PASSWORD</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 6 characters"
              placeholderTextColor="#444"
              secureTextEntry
            />
          </View>

          {isRegister && (
            <View style={s.field}>
              <Text style={s.label}>CONFIRM PASSWORD</Text>
              <TextInput
                style={s.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Repeat password"
                placeholderTextColor="#444"
                secureTextEntry
              />
            </View>
          )}

          <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnTxt}>{isRegister ? '🚀 Create Account' : '🔑 Sign In'}</Text>}
          </TouchableOpacity>

          <Text style={s.switchTxt}>
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={s.switchLink} onPress={() => setMode(isRegister ? 'login' : 'register')}>
              {isRegister ? 'Sign In' : 'Create one'}
            </Text>
          </Text>
        </View>

        <Text style={s.footerTxt}>
          Your account lets you submit runs to the{'\n'}global leaderboard and track your car's progress.
        </Text>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  scroll: { flexGrow: 1 },
  header: { paddingTop: 60, paddingBottom: 32, paddingHorizontal: 24, alignItems: 'center' },
  logo: { color: '#e51515', fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  tagline: { color: '#333', fontSize: 13, marginTop: 6, letterSpacing: 1, textTransform: 'uppercase' },

  card: { backgroundColor: '#111', borderRadius: 16, margin: 16, padding: 20 },

  tabRow: { flexDirection: 'row', backgroundColor: '#0a0a0a', borderRadius: 10, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#1e0000' },
  tabTxt: { color: '#444', fontWeight: '700', fontSize: 13 },
  tabTxtActive: { color: '#e51515' },

  field: { marginBottom: 14 },
  label: { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  input: {
    backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#222',
    borderRadius: 10, color: '#fff', fontSize: 15, padding: 13, fontWeight: '500',
  },

  btn: { backgroundColor: '#e51515', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },

  switchTxt: { color: '#444', fontSize: 13, textAlign: 'center', marginTop: 16 },
  switchLink: { color: '#e51515', fontWeight: '700' },

  footerTxt: { color: '#222', fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
