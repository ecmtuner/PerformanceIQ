// Dragy GPS Data Parser & Performance Calculator

// Parse NMEA GPRMC / GNRMC sentence for speed
export const parseNMEASpeed = (sentence) => {
  // $GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A
  // Speed is field index 7 in knots
  try {
    if (!sentence.startsWith('$GPRMC') && !sentence.startsWith('$GNRMC')) return null;
    const parts = sentence.split(',');
    if (parts[2] !== 'A') return null; // A = active/valid
    const speedKnots = parseFloat(parts[7]);
    if (isNaN(speedKnots)) return null;
    return speedKnots * 1.15078; // knots → mph
  } catch { return null; }
};

// Parse GPVTG for speed (backup)
export const parseNMEAVTG = (sentence) => {
  try {
    if (!sentence.startsWith('$GPVTG') && !sentence.startsWith('$GNVTG')) return null;
    const parts = sentence.split(',');
    const speedKmh = parseFloat(parts[7]);
    if (isNaN(speedKmh)) return null;
    return speedKmh * 0.621371; // km/h → mph
  } catch { return null; }
};

// Performance run calculator
export class RunCalculator {
  constructor() {
    this.samples = []; // [{time, speedMph}]
    this.running = false;
    this.launched = false;
  }

  addSample(speedMph) {
    const now = Date.now();
    this.samples.push({ time: now, speedMph });

    // Auto-detect launch: speed crosses 5 mph
    if (!this.launched && speedMph >= 5) {
      this.launched = true;
      this.launchTime = now;
      this.samples = [{ time: now, speedMph }]; // reset from launch
    }
  }

  getTimeAt(targetMph) {
    if (!this.launched || this.samples.length < 2) return null;
    for (let i = 1; i < this.samples.length; i++) {
      if (this.samples[i].speedMph >= targetMph) {
        // Interpolate between samples i-1 and i
        const s0 = this.samples[i-1], s1 = this.samples[i];
        const frac = (targetMph - s0.speedMph) / (s1.speedMph - s0.speedMph);
        const t = s0.time + frac * (s1.time - s0.time);
        return ((t - this.launchTime) / 1000).toFixed(3);
      }
    }
    return null;
  }

  // Calculate roll race time between two speeds
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
