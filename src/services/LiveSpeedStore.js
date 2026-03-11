/**
 * LiveSpeedStore — global singleton
 * DragyGPSScreen pushes speed here every update.
 * Any screen (Race Room, etc.) can subscribe to live speed.
 */

let _currentSpeed = 0;
let _listeners = [];

export const LiveSpeedStore = {
  update(speedMph) {
    _currentSpeed = speedMph;
    _listeners.forEach(fn => fn(speedMph));
  },
  getSpeed() {
    return _currentSpeed;
  },
  subscribe(fn) {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  },
};
