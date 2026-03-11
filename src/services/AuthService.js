import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDPVPHddSlF1fNh-69tdxkDHlXhK8HMJNo",
  authDomain: "performanceiq-app.firebaseapp.com",
  projectId: "performanceiq-app",
  storageBucket: "performanceiq-app.firebasestorage.app",
  messagingSenderId: "1004679127568",
  appId: "1:1004679127568:web:bb6a3e98a32c980b01a095"
};

let _app, _auth, _db;
const init = () => {
  if (!_app) {
    _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    _auth = getAuth(_app);
    _db = getFirestore(_app);
  }
  return { auth: _auth, db: _db };
};

const USER_KEY = 'piq_user';

// Save minimal user info locally so we don't need Firebase to re-auth every launch
export const saveUserLocally = async (user) => {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.username || '',
  }));
};

export const getLocalUser = async () => {
  const d = await AsyncStorage.getItem(USER_KEY);
  return d ? JSON.parse(d) : null;
};

export const clearLocalUser = async () => {
  await AsyncStorage.removeItem(USER_KEY);
};

// Register new account
export const registerUser = async (email, password, username) => {
  try {
    const { auth, db } = init();
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: username.trim() });
    // Save user doc to Firestore
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email: email.trim().toLowerCase(),
      username: username.trim(),
      createdAt: serverTimestamp(),
    });
    await saveUserLocally({ uid: cred.user.uid, email: email.trim(), displayName: username.trim() });
    return { success: true, user: { uid: cred.user.uid, email: email.trim(), displayName: username.trim() } };
  } catch (e) {
    let msg = e.message;
    if (e.code === 'auth/email-already-in-use') msg = 'That email is already registered.';
    if (e.code === 'auth/invalid-email') msg = 'Invalid email address.';
    if (e.code === 'auth/weak-password') msg = 'Password must be at least 6 characters.';
    return { success: false, error: msg };
  }
};

// Sign in existing account
export const loginUser = async (email, password) => {
  try {
    const { auth } = init();
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const displayName = cred.user.displayName || email.split('@')[0];
    await saveUserLocally({ uid: cred.user.uid, email: cred.user.email, displayName });
    return { success: true, user: { uid: cred.user.uid, email: cred.user.email, displayName } };
  } catch (e) {
    let msg = e.message;
    if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') msg = 'Incorrect email or password.';
    if (e.code === 'auth/invalid-email') msg = 'Invalid email address.';
    if (e.code === 'auth/too-many-requests') msg = 'Too many attempts. Try again later.';
    return { success: false, error: msg };
  }
};

// Sign out
export const signOut = async () => {
  try {
    const { auth } = init();
    await fbSignOut(auth);
    await clearLocalUser();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

// Get current Firebase user (live)
export const getCurrentFirebaseUser = () => {
  const { auth } = init();
  return auth.currentUser;
};
