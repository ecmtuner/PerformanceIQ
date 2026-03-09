// Dragy GPS Data Parser & Performance Calculator
// Uses u-blox M8 chip — outputs standard NMEA 0183 at 10Hz

// Parse GPRMC or GNRMC sentence for speed
// $GNRMC,123519.00,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W,A*XX
export const parseNMEASpeed = (sentence) => {
  try {
    const s = sentence.trim();
    if (!s.startsWith('$GPRMC') && !s.startsWith('$GNRMC')) return null;
    const parts = s.split(',');
    if (parts.length < 8) return null;
    if (parts[2] !== 'A') return null; // A = active/valid fix
    const speedKnots = parseFloat(parts[7]);
    if (isNaN(speedKnots)) return null;
    return speedKnots * 1.15078; // knots → mph
  } catch { return null; }
};

// Parse GPVTG or GNVTG for speed (backup sentence)
// $GNVTG,054.7,T,034.4,M,005.5,N,010.2,K,A*XX
export const parseNMEAVTG = (sentence) => {
  try {
    const s = sentence.trim();
    if (!s.startsWith('$GPVTG') && !s.startsWith('$GNVTG')) return null;
    const parts = s.split(',');
    if (parts.length < 8) return null;
    // Field 7 = speed in km/h
    const speedKmh = parseFloat(parts[7]);
    if (!isNaN(speedKmh)) return speedKmh * 0.621371;
    // Field 5 = speed in knots (fallback)
    const speedKnots = parseFloat(parts[5]);
    if (!isNaN(speedKnots)) return speedKnots * 1.15078;
    return null;
  } catch { return null; }
};

// Parse GPGGA or GNGGA for altitude (used in density altitude)
export const parseNMEAAltitude = (sentence) => {
  try {
    const s = sentence.trim();
    if (!s.startsWith('$GPGGA') && !s.startsWith('$GNGGA')) return null;
    const parts = s.split(',');
    if (parts[6] === '0') return null; // no fix
    const alt = parseFloat(parts[9]);
    return isNaN(alt) ? null : alt; // meters
  } catch { return null; }
};

// Split raw BLE buffer into complete NMEA sentences
// u-blox uses \r\n line endings
export const splitNMEABuffer = (buffer) => {
  const lines = buffer.split(/\r\n|\r|\n/);
  const remaining = lines.pop(); // keep incomplete last line
  const complete = lines.map(l => l.trim()).filter(l => l.startsWith('$'));
  return { sentences: complete, remaining };
};

// Performance run calculator
export class RunCalculator {
  constructor() {
    this.samples = [];
    this.launched = false;
    this.launchTime = null;
  }

  addSample(speedMph) {
    const now = Date.now();
    this.samples.push({ time: now, speedMph });

    // Auto-detect launch: speed crosses 3 mph threshold
    if (!this.launched && speedMph >= 3) {
      this.launched = true;
      this.launchTime = now;
      this.samples = [{ time: now, speedMph }];
    }
  }

  getTimeAt(targetMph) {
    if (!this.launched || this.samples.length < 2) return null;
    for (let i = 1; i < this.samples.length; i++) {
      if (this.samples[i].speedMph >= targetMph) {
        const s0 = this.samples[i-1], s1 = this.samples[i];
        const frac = (targetMph - s0.speedMph) / (s1.speedMph - s0.speedMph);
        const t = s0.time + frac * (s1.time - s0.time);
        return ((t - this.launchTime) / 1000).toFixed(3);
      }
    }
    return null;
  }

  getRollTime(fromMph, toMph) {
    let fromTime = null, toTime = null;
    for (let i = 1; i < this.samples.length; i++) {
      if (!fromTime && this.samples[i].speedMph >= fromMph) {
        const s0 = this.samples[i-1], s1 = this.samples[i];
        const frac = (fromMph - s0.speedMph) / (s1.speedMph - s0.speedMph);
        fromTime = s0.time + frac * (s1.time - s0.time);
      }
      if (fromTime && !toTime && this.samples[i].speedMph >= toMph) {
        const s0 = this.samples[i-1], s1 = this.samples[i];
        const frac = (toMph - s0.speedMph) / (s1.speedMph - s0.speedMph);
        toTime = s0.time + frac * (s1.time - s0.time);
        return ((toTime - fromTime) / 1000).toFixed(3);
      }
    }
    return null;
  }

  reset() {
    this.samples = [];
    this.launched = false;
    this.launchTime = null;
  }

  getCurrentSpeed() {
    return this.samples.length > 0 ? this.samples[this.samples.length - 1].speedMph : 0;
  }

  getPeakSpeed() {
    return this.samples.length > 0 ? Math.max(...this.samples.map(s => s.speedMph)) : 0;
  }
}
