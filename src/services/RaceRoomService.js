import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  onSnapshot, serverTimestamp, deleteDoc
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDPVPHddSlF1fNh-69tdxkDHlXhK8HMJNo",
  authDomain: "performanceiq-app.firebaseapp.com",
  projectId: "performanceiq-app",
  storageBucket: "performanceiq-app.firebasestorage.app",
  messagingSenderId: "1004679127568",
  appId: "1:1004679127568:web:bb6a3e98a32c980b01a095"
};

let _app, _db;
const getDB = () => {
  if (!_db) {
    _app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    _db = getFirestore(_app);
  }
  return _db;
};

// Generate a 6-char room code
export const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

/**
 * Create a new race room.
 * Returns the roomCode.
 */
export const createRoom = async ({ uid, username, car }) => {
  const db = getDB();
  const roomCode = generateRoomCode();
  await setDoc(doc(db, 'races', roomCode), {
    status: 'waiting',         // waiting | negotiating | locked | countdown | racing | finished | abandoned
    createdAt: serverTimestamp(),
    proposedParams: null,      // { startSpeed, finishSpeed, proposedBy: 'r1'|'r2' }
    agreedParams: null,        // set when both agree
    startTimestamp: null,
    winner: null,
    r1: { uid, username, car, ready: false, speed: 0, finished: false, finishTime: null, elapsedMs: null },
    r2: null,
  });
  return roomCode;
};

/**
 * Join an existing room as r2.
 * Returns the room data, or throws if full/not found.
 */
export const joinRoom = async ({ roomCode, uid, username, car }) => {
  const db = getDB();
  const ref = doc(db, 'races', roomCode.toUpperCase());
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Room not found. Check the code and try again.');
  const data = snap.data();
  if (data.r2) throw new Error('Room is full. Race already has 2 racers.');
  if (data.status !== 'waiting') throw new Error('Race already started.');
  await updateDoc(ref, {
    r2: { uid, username, car, ready: false, speed: 0, finished: false, finishTime: null, elapsedMs: null },
    status: 'negotiating',
  });
  return { roomCode: roomCode.toUpperCase(), role: 'r2' };
};

/**
 * Propose race params (start/finish speed). Either racer can propose or counter-propose.
 */
export const proposeParams = async (roomCode, { startSpeed, finishSpeed, proposedBy }) => {
  const db = getDB();
  await updateDoc(doc(db, 'races', roomCode), {
    proposedParams: { startSpeed, finishSpeed, proposedBy },
    agreedParams: null,
    'r1.ready': false,
    'r2.ready': false,
  });
};

/**
 * Accept the current proposed params — both agree → locks the room.
 */
export const acceptParams = async (roomCode) => {
  const db = getDB();
  const snap = await getDoc(doc(db, 'races', roomCode));
  const { proposedParams } = snap.data();
  if (!proposedParams) throw new Error('No params proposed yet.');
  await updateDoc(doc(db, 'races', roomCode), {
    agreedParams: { startSpeed: proposedParams.startSpeed, finishSpeed: proposedParams.finishSpeed },
    status: 'locked',
  });
};

/**
 * Mark racer as ready. When both ready → trigger countdown.
 */
export const setReady = async (roomCode, role) => {
  const db = getDB();
  await updateDoc(doc(db, 'races', roomCode), { [`${role}.ready`]: true });
  // Check if both ready
  const snap = await getDoc(doc(db, 'races', roomCode));
  const d = snap.data();
  if (d.r1?.ready && d.r2?.ready) {
    await updateDoc(doc(db, 'races', roomCode), {
      status: 'countdown',
      startTimestamp: Date.now() + 33000, // 30s prep + 3s lights
    });
  }
};

/**
 * Push local racer's current speed to Firebase (throttle calls to 1/sec).
 */
export const pushSpeed = async (roomCode, role, speedMph) => {
  const db = getDB();
  await updateDoc(doc(db, 'races', roomCode), { [`${role}.speed`]: parseFloat(speedMph.toFixed(1)) });
};

/**
 * Mark racer as finished (hit finish speed).
 */
export const markFinished = async (roomCode, role, elapsedMs) => {
  const db = getDB();
  const now = Date.now();
  await updateDoc(doc(db, 'races', roomCode), {
    [`${role}.finished`]: true,
    [`${role}.finishTime`]: now,
    [`${role}.elapsedMs`]: elapsedMs,
  });
  // Check if other racer already finished → set winner
  const snap = await getDoc(doc(db, 'races', roomCode));
  const d = snap.data();
  const other = role === 'r1' ? 'r2' : 'r1';
  if (d[other]?.finished) {
    // Both finished — compare elapsed times
    const myTime = elapsedMs;
    const theirTime = d[other].elapsedMs;
    const winner = myTime < theirTime ? role : other;
    await updateDoc(doc(db, 'races', roomCode), { status: 'finished', winner });
  } else {
    // First to finish
    await updateDoc(doc(db, 'races', roomCode), { status: 'finished', winner: role });
  }
};

/**
 * Subscribe to real-time room updates.
 * Returns unsubscribe function.
 */
export const subscribeRoom = (roomCode, callback) => {
  const db = getDB();
  return onSnapshot(doc(db, 'races', roomCode), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
};

/**
 * Abandon/leave the room.
 */
export const abandonRoom = async (roomCode, role) => {
  const db = getDB();
  await updateDoc(doc(db, 'races', roomCode), { status: 'abandoned', [`${role}.abandoned`]: true });
};
