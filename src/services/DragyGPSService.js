// Dragy GPS — u-blox MAX-M8Q NMEA Parser

// Parse GPRMC/GNRMC — accepts both A (active) and V (void) for debugging
export const parseNMEASpeed = (sentence, requireFix = true) => {
  try {
    const s = sentence.trim();
    if (!s.startsWith('$GPRMC') && !s.startsWith('$GNRMC')) return null;
    const parts = s.split(',');
    if (parts.length < 8) return null;
    if (requireFix && parts[2] !== 'A') return null;
    const speedKnots = parseFloat(parts[7]);
    if (isNaN(speedKnots)) return null;
    return speedKnots * 1.15078;
  } catch { return null; }
};

// Parse GPVTG/GNVTG
export const parseNMEAVTG = (sentence) => {
  try {
    const s = sentence.trim();
    if (!s.startsWith('$GPVTG') && !s.startsWith('$GNVTG')) return null;
    const parts = s.split(',');
    if (parts.length < 8) return null;
    const speedKmh = parseFloat(parts[7]);
    if (!isNaN(speedKmh)) return speedKmh * 0.621371;
    const speedKnots = parseFloat(parts[5]);
    if (!isNaN(speedKnots)) return speedKnots * 1.15078;
    return null;
  } catch { return null; }
};

// Check GPS fix status from GNRMC
export const parseFixStatus = (sentence) => {
  try {
    const s = sentence.trim();
    if (!s.startsWith('$GPRMC') && !s.startsWith('$GNRMC')) return null;
    const parts = s.split(',');
    return parts[2] === 'A' ? 'fix' : 'no-fix';
  } catch { return null; }
};

// Split BLE buffer into complete NMEA sentences (u-blox uses \r\n)
export const splitNMEABuffer = (buffer) => {
  const lines = buffer.split(/\r\n|\r|\n/);
  const remaining = lines.pop();
  const complete = lines.map(l => l.trim()).filter(l => l.startsWith('$') || l.startsWith('@'));
  return { sentences: complete, remaining };
};

export class RunCalculator {
  constructor() { this.samples = []; this.altSamples = []; this.launched = false; this.launchTime = null; }

  addSample(speedMph, altM = 0) {
    const now = Date.now();
    this.samples.push({ time: now, speedMph });
    this.altSamples.push({ time: now, altM });
    if (!this.launched && speedMph >= 3) {
      this.launched = true;
      this.launchTime = now;
      this.samples = [{ time: now, speedMph }];
      this.altSamples = [{ time: now, altM }];
    }
  }

  getTimeAt(targetMph) {
    if (!this.launched || this.samples.length < 2) return null;
    for (let i = 1; i < this.samples.length; i++) {
      if (this.samples[i].speedMph >= targetMph) {
        const s0 = this.samples[i-1], s1 = this.samples[i];
        const frac = (targetMph - s0.speedMph) / (s1.speedMph - s0.speedMph);
        return (((s0.time + frac * (s1.time - s0.time)) - this.launchTime) / 1000).toFixed(3);
      }
    }
    return null;
  }

  getRollTime(fromMph, toMph) {
    let fromTime = null;
    for (let i = 1; i < this.samples.length; i++) {
      if (!fromTime && this.samples[i].speedMph >= fromMph) {
        const s0 = this.samples[i-1], s1 = this.samples[i];
        fromTime = s0.time + ((fromMph - s0.speedMph) / (s1.speedMph - s0.speedMph)) * (s1.time - s0.time);
      }
      if (fromTime && this.samples[i].speedMph >= toMph) {
        const s0 = this.samples[i-1], s1 = this.samples[i];
        const toTime = s0.time + ((toMph - s0.speedMph) / (s1.speedMph - s0.speedMph)) * (s1.time - s0.time);
        return ((toTime - fromTime) / 1000).toFixed(3);
      }
    }
    return null;
  }

  reset() { this.samples = []; this.altSamples = []; this.launched = false; this.launchTime = null; }
  getCurrentSpeed() { return this.samples.length > 0 ? this.samples[this.samples.length - 1].speedMph : 0; }
  getPeakSpeed() { return this.samples.length > 0 ? Math.max(...this.samples.map(s => s.speedMph)) : 0; }
}

// Parse Dragy proprietary '@' sentence
// CONFIRMED format (from drive log analysis):
//   @,<speed_kmh>,<time>,<lat>,<lon>,<fix(0/1)>,<sats>,<altitude_m>,<heading>
//   parts[1] = speed in km/h  ← ALWAYS the speed
//   parts[5] = fix quality (0=no fix, 1=fix)
//   parts[7] = altitude in meters (NOT speed — was ~0.79m = sea level, Moonachie NJ)
// Occasional GGA-style variant: parts[7]='M' (altitude unit) — speed still at parts[1]
export const parseDragySentence = (sentence) => {
  try {
    const s = sentence.trim();
    if (!s.startsWith('@')) return null;
    const parts = s.split(',');
    if (parts.length < 6) return null;

    // Speed is ALWAYS at parts[1]
    const speedKmh = parseFloat(parts[1]);
    if (isNaN(speedKmh) || speedKmh < 0) return null;

    // Fix detection: normal sentences have parts[5]=0 or 1
    // GGA-style variant has parts[7]='M' and fix implied by lat/lon presence
    let hasFix;
    if (parts[7] === 'M' || parts[7] === 'm') {
      hasFix = !!(parts[3] && parts[3].length > 3);
    } else {
      hasFix = parseInt(parts[5]) > 0;
    }

    return { speedMph: speedKmh * 0.621371, hasFix: !!hasFix, time: parts[2] || null };
  } catch { return null; }
};
