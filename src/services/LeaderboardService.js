import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, addDoc, query, orderBy, limit, where, getDocs, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDPVPHddSlF1fNh-69tdxkDHlXhK8HMJNo",
  authDomain: "performanceiq-app.firebaseapp.com",
  projectId: "performanceiq-app",
  storageBucket: "performanceiq-app.firebasestorage.app",
  messagingSenderId: "1004679127568",
  appId: "1:1004679127568:web:bb6a3e98a32c980b01a095"
};

let app, db;
const initFirebase = () => {
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
  return db;
};

export const submitRun = async ({ bracket, rawTime, correctedTime, slope, distanceFt, peakSpeed, car, location }) => {
  try {
    const db = initFirebase();
    await addDoc(collection(db, 'leaderboard'), {
      bracket: bracket?.label || '0-60',
      bracketFrom: bracket?.from || 0,
      bracketTo: bracket?.to || 60,
      rawTime: parseFloat(rawTime) || null,
      correctedTime: parseFloat(correctedTime) || null,
      slope: parseFloat(slope) || 0,
      distanceFt: parseFloat(distanceFt) || 0,
      peakSpeed: parseFloat(peakSpeed) || 0,
      carMake: car?.make || 'Unknown',
      carModel: car?.model || 'Unknown',
      carYear: car?.year || '',
      carEngine: car?.engine || '',
      vin: car?.vin || null,
      location: location || '',
      timestamp: serverTimestamp(),
      verified: !!car?.vin, // VIN-verified flag
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

export const fetchLeaderboard = async ({ bracket, make, model, year, limitCount = 50 } = {}) => {
  try {
    const db = initFirebase();
    let q = query(collection(db, 'leaderboard'), orderBy('correctedTime', 'asc'), limit(limitCount));
    // Firestore needs composite indexes for multi-field filters; filter in JS for now
    const snap = await getDocs(q);
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (bracket) results = results.filter(r => r.bracket === bracket);
    if (make)    results = results.filter(r => r.carMake?.toLowerCase().includes(make.toLowerCase()));
    if (model)   results = results.filter(r => r.carModel?.toLowerCase().includes(model.toLowerCase()));
    if (year)    results = results.filter(r => r.carYear === year);
    return results;
  } catch (e) {
    return [];
  }
};
