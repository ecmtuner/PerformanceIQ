import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, InputAccessoryView, Keyboard } from 'react-native';

// Shows a "Done" bar above the keyboard on iOS for numeric keypads that have no return key
export default function KeyboardToolbar({ inputAccessoryViewID, onNext, onDone }) {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={inputAccessoryViewID}>
      <View style={styles.toolbar}>
        {onNext && (
          <TouchableOpacity onPress={onNext} style={styles.btn}>
            <Text style={styles.btnText}>Next ⇥</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onDone || Keyboard.dismiss} style={[styles.btn, styles.doneBtn]}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', backgroundColor: '#1a1a1a', borderTopWidth: 1, borderTopColor: '#333', paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  btn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  btnText: { color: '#5588ff', fontSize: 15, fontWeight: '600' },
  doneBtn: { backgroundColor: '#e51515', borderRadius: 8 },
  doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
