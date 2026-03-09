import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveCarProfile = async (profile) => AsyncStorage.setItem('car_profile', JSON.stringify(profile));
export const getCarProfile = async () => { const d = await AsyncStorage.getItem('car_profile'); return d ? JSON.parse(d) : null; };

export const saveRun = async (run) => {
  const existing = await getRuns();
  const updated = [{ ...run, id: Date.now(), date: new Date().toISOString() }, ...existing];
  await AsyncStorage.setItem('run_log', JSON.stringify(updated.slice(0, 200)));
};
export const getRuns = async () => { const d = await AsyncStorage.getItem('run_log'); return d ? JSON.parse(d) : []; };
export const deleteRun = async (id) => { const runs = await getRuns(); await AsyncStorage.setItem('run_log', JSON.stringify(runs.filter(r => r.id !== id))); };

export const saveNote = async (note) => {
  const existing = await getNotes();
  const updated = [{ id: Date.now(), date: new Date().toISOString(), text: note }, ...existing];
  await AsyncStorage.setItem('tune_notes', JSON.stringify(updated));
};
export const getNotes = async () => { const d = await AsyncStorage.getItem('tune_notes'); return d ? JSON.parse(d) : []; };
export const deleteNote = async (id) => { const notes = await getNotes(); await AsyncStorage.setItem('tune_notes', JSON.stringify(notes.filter(n => n.id !== id))); };
