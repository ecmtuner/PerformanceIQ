// Global run store — avoids passing large arrays through navigation params
let _lastRun = null;

export const setLastRun = (samples, altSamples, satellites) => {
  _lastRun = { samples: [...samples], altSamples: [...altSamples], satellites };
};

export const getLastRun = () => _lastRun;
