import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

// ─── Anthropic API Key (set in .env as ANTHROPIC_API_KEY) ────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// ─── Firebase (reuse existing config) ────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDPVPHddSlF1fNh-69tdxkDHlXhK8HMJNo",
  authDomain: "performanceiq-app.firebaseapp.com",
  projectId: "performanceiq-app",
  storageBucket: "performanceiq-app.firebasestorage.app",
  messagingSenderId: "1004679127568",
  appId: "1:1004679127568:web:bb6a3e98a32c980b01a095"
};

const getDB = () => {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return getFirestore(app);
};

// ─── AsyncStorage key ─────────────────────────────────────────────────────────
const HISTORY_KEY = 'log_analyzer_history';

// ─── Column aliases (case-insensitive matching) ───────────────────────────────
const CHANNEL_ALIASES = {
  coolant: ['coolant temp', 'clt', 'engine coolant temperature', 'coolant'],
  iat:     ['iat', 'intake air temp', 'air temp', 'intake air temperature'],
  timing:  ['ignition timing', 'timing', 'ign', 'spark advance'],
  knock:   ['knock', 'knock retard', 'knock activity', 'knock sum', 'knock level'],
  afr:     ['afr', 'lambda', 'air fuel ratio', 'wideband', 'o2'],
  boost:   ['boost', 'map', 'boost pressure', 'manifold pressure', 'boost psi'],
  battery: ['battery', 'battery voltage', 'batt v', 'batt', 'voltage'],
  rpm:     ['rpm', 'engine speed', 'engine rpm'],
};

// ─── CSV Parser ───────────────────────────────────────────────────────────────
export function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV file is empty or has no data rows.');

  // Find header row — first line with multiple comma-separated values
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].split(',').length > 3) { headerIdx = i; break; }
  }

  const rawHeaders = lines[headerIdx].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const dataLines = lines.slice(headerIdx + 1);

  // Map channel names to column indices
  const colMap = {};
  rawHeaders.forEach((h, idx) => {
    const lower = h.toLowerCase();
    for (const [channel, aliases] of Object.entries(CHANNEL_ALIASES)) {
      if (aliases.some(a => lower.includes(a))) {
        if (!colMap[channel]) colMap[channel] = idx;
      }
    }
  });

  // Parse data rows
  const rows = dataLines
    .map(line => line.split(',').map(v => v.trim().replace(/^"|"$/g, '')))
    .filter(cols => cols.length >= rawHeaders.length / 2);

  // Compute stats per channel
  const stats = {};
  for (const [channel, colIdx] of Object.entries(colMap)) {
    const vals = rows
      .map(r => parseFloat(r[colIdx]))
      .filter(v => !isNaN(v));
    if (vals.length === 0) continue;
    stats[channel] = {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      count: vals.length,
    };
  }

  // Sample up to 500 evenly spaced rows for AI
  const sampleSize = Math.min(500, rows.length);
  const step = Math.max(1, Math.floor(rows.length / sampleSize));
  const sampledRows = rows.filter((_, i) => i % step === 0).slice(0, sampleSize);

  return { headers: rawHeaders, colMap, stats, sampledRows, totalRows: rows.length };
}

// ─── Build AI prompt ──────────────────────────────────────────────────────────
function buildPrompt(parsed, filename) {
  const { stats, sampledRows, headers, colMap, totalRows } = parsed;

  const statsText = Object.entries(stats)
    .map(([ch, s]) =>
      `${ch.toUpperCase()}: min=${s.min.toFixed(2)}, max=${s.max.toFixed(2)}, avg=${s.avg.toFixed(2)} (${s.count} samples)`
    ).join('\n');

  // Build a small CSV sample for context
  const sampleHeaders = Object.entries(colMap)
    .map(([ch, idx]) => `${ch}(${headers[idx]})`).join(', ');
  const sampleData = sampledRows.slice(0, 30)
    .map(row =>
      Object.values(colMap).map(idx => row[idx] || '').join(', ')
    ).join('\n');

  return `You are an expert ECU tuner analyzing a BM3 datalog from a BMW performance car.

FILE: ${filename}
TOTAL ROWS: ${totalRows}

CHANNEL STATISTICS:
${statsText || 'No recognized channels found.'}

SAMPLE DATA (first 30 of ${Math.min(500, totalRows)} sampled rows):
Columns: ${sampleHeaders}
${sampleData}

Analyze this log and return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "healthScore": <0-100 integer>,
  "summary": "<1-2 sentence overall assessment>",
  "channels": {
    "coolant": { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<brief tuner note>", "min": <number>, "max": <number>, "avg": <number> },
    "iat":     { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<brief tuner note>", "min": <number>, "max": <number>, "avg": <number> },
    "timing":  { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<brief tuner note>", "min": <number>, "max": <number>, "avg": <number> },
    "knock":   { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<brief tuner note>", "min": <number>, "max": <number>, "avg": <number> },
    "afr":     { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<brief tuner note>", "min": <number>, "max": <number>, "avg": <number> },
    "boost":   { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<brief tuner note>", "min": <number>, "max": <number>, "avg": <number> },
    "battery": { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<brief tuner note>", "min": <number>, "max": <number>, "avg": <number> }
  },
  "recommendations": ["<rec 1>", "<rec 2>", "<rec 3>"]
}

Rules:
- Use N/A status if channel data was not found in the log
- For N/A channels set min/max/avg to null
- healthScore: 90-100=excellent, 75-89=good, 60-74=caution, <60=needs attention
- Be concise but specific — mention actual values in notes when relevant
- Flag knock retard >2° as WARNING, >4° as CRITICAL
- Flag IAT >45°C as WARNING, >55°C as CRITICAL  
- Flag AFR <11.5 or >13.5 at high load as WARNING
- Flag coolant >105°C as WARNING, >115°C as CRITICAL`;
}

// ─── Call Claude Haiku ────────────────────────────────────────────────────────
async function callClaude(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI analysis failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI returned invalid response format.');

  return JSON.parse(jsonMatch[0]);
}

// ─── Main analysis function ───────────────────────────────────────────────────
export async function analyzeLog({ fileContent, filename, uid, carName }) {
  // 1. Parse CSV
  const parsed = parseCSV(fileContent);

  // 2. Build prompt & call AI
  const prompt = buildPrompt(parsed, filename);
  const report = await callClaude(prompt);

  // 3. Merge parsed stats into report channels (fill in min/max/avg from local parse if AI left nulls)
  for (const [channel, localStats] of Object.entries(parsed.stats)) {
    if (report.channels[channel]) {
      const ch = report.channels[channel];
      if (ch.min === null || ch.min === undefined) ch.min = parseFloat(localStats.min.toFixed(2));
      if (ch.max === null || ch.max === undefined) ch.max = parseFloat(localStats.max.toFixed(2));
      if (ch.avg === null || ch.avg === undefined) ch.avg = parseFloat(localStats.avg.toFixed(2));
    }
  }

  // 4. Build history entry
  const entry = {
    id: Date.now().toString(),
    filename,
    carName: carName || 'Unknown Car',
    date: new Date().toISOString(),
    healthScore: report.healthScore,
    summary: report.summary,
    channels: report.channels,
    recommendations: report.recommendations,
    totalRows: parsed.totalRows,
  };

  // 5. Save to AsyncStorage history
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    history.unshift(entry);
    if (history.length > 10) history.splice(10);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('LogAnalyzer: history save failed', e);
  }

  // 6. Log to Firestore (best-effort)
  if (uid) {
    try {
      const db = getDB();
      await addDoc(collection(db, 'logAnalyses'), {
        uid,
        filename,
        carName: carName || 'Unknown',
        healthScore: report.healthScore,
        channelStatuses: Object.fromEntries(
          Object.entries(report.channels).map(([k, v]) => [k, v.status])
        ),
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.warn('LogAnalyzer: Firestore log failed', e);
    }
  }

  return entry;
}

// ─── History helpers ──────────────────────────────────────────────────────────
export async function getAnalysisHistory() {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearAnalysisHistory() {
  await AsyncStorage.removeItem(HISTORY_KEY);
}
