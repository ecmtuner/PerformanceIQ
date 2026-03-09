import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { saveNote, getNotes, deleteNote } from '../utils/storage';

export default function TuneNotesScreen() {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState('');

  useFocusEffect(useCallback(() => { getNotes().then(setNotes); }, []));

  const add = async () => {
    if (!text.trim()) return;
    await saveNote(text.trim());
    setText('');
    getNotes().then(setNotes);
  };

  const remove = (id) => {
    Alert.alert('Delete Note', 'Remove this note?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteNote(id); getNotes().then(setNotes); } },
    ]);
  };

  const NoteCard = ({ note }) => {
    const d = new Date(note.date);
    return (
      <View style={styles.noteCard}>
        <View style={styles.noteHeader}>
          <Text style={styles.noteDate}>{d.toLocaleDateString()} · {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
          <TouchableOpacity onPress={() => remove(note.id)}><Text style={styles.deleteBtn}>🗑️</Text></TouchableOpacity>
        </View>
        <Text style={styles.noteText}>{note.text}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0a0a0a' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        <Text style={styles.title}>Tune Notes</Text>
        <Text style={styles.subtitle}>Session log & observations</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={setText}
            placeholder="e.g. E40, 520whp, DA 800ft, best 4.21s..."
            placeholderTextColor="#444"
            multiline
            returnKeyType="default"
            blurOnSubmit={false}
          />
          <TouchableOpacity style={styles.addBtn} onPress={add}>
            <Text style={styles.addBtnText}>ADD</Text>
          </TouchableOpacity>
        </View>
        {notes.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyText}>No notes yet</Text>
            <Text style={styles.emptyHint}>Log your tune sessions, observations, and setup changes.</Text>
          </View>
        ) : (
          <FlatList data={notes} keyExtractor={n => String(n.id)} renderItem={({ item }) => <NoteCard note={item} />}
            contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always" />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { color: '#e51515', fontSize: 28, fontWeight: '800', marginTop: 12 },
  subtitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 16 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 16, alignItems: 'flex-end' },
  textInput: { flex: 1, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333', borderRadius: 10, color: '#fff', fontSize: 14, padding: 12, minHeight: 60, textAlignVertical: 'top' },
  addBtn: { backgroundColor: '#e51515', borderRadius: 10, padding: 16, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  noteCard: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  noteDate: { color: '#555', fontSize: 12 },
  deleteBtn: { fontSize: 16 },
  noteText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#555', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyHint: { color: '#333', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
