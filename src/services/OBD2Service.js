import { btoa, atob } from 'react-native-quick-base64';

// ELM327 AT Commands — init sequence (order matters)
export const AT_COMMANDS = {
  RESET:           'ATZ\r',    // full reset — wait 1500ms after this
  ECHO_OFF:        'ATE0\r',   // suppress command echo
  LINEFEED_OFF:    'ATL0\r',   // no extra linefeeds
  SPACES_OFF:      'ATS0\r',   // remove spaces from response bytes (cleaner parsing)
  HEADERS_OFF:     'ATH0\r',   // strip CAN/ISO-TP headers — we just want data bytes
  CAF_ON:          'ATCAF1\r', // CAN auto format ON — ELM formats multi-frame responses
  ADAPTIVE_TIMING: 'ATAT2\r',  // aggressive adaptive timing (faster responses)
  AUTO_PROTOCOL:   'ATSP0\r',  // auto-detect OBD protocol (run last)
};

// OBD2 PIDs
export const PIDS = {
  RPM:           { cmd: '010C\r', name: 'RPM',            unit: 'rpm',  parse: (d) => ((d[0]*256 + d[1]) / 4).toFixed(0) },
  SPEED:         { cmd: '010D\r', name: 'Speed',          unit: 'mph',  parse: (d) => (d[0] * 0.621371).toFixed(1) },
  COOLANT_TEMP:  { cmd: '0105\r', name: 'Coolant Temp',   unit: '°F',   parse: (d) => ((d[0] - 40) * 9/5 + 32).toFixed(0) },
  INTAKE_TEMP:   { cmd: '010F\r', name: 'Intake Temp',    unit: '°F',   parse: (d) => ((d[0] - 40) * 9/5 + 32).toFixed(0) },
  THROTTLE:      { cmd: '0111\r', name: 'Throttle',       unit: '%',    parse: (d) => (d[0] * 100 / 255).toFixed(1) },
  ENGINE_LOAD:   { cmd: '0104\r', name: 'Engine Load',    unit: '%',    parse: (d) => (d[0] * 100 / 255).toFixed(1) },
  TIMING_ADV:    { cmd: '010E\r', name: 'Timing Advance', unit: '°',    parse: (d) => (d[0] / 2 - 64).toFixed(1) },
  SHORT_FUEL:    { cmd: '0106\r', name: 'Short Fuel Trim',unit: '%',    parse: (d) => ((d[0] - 128) * 100 / 128).toFixed(1) },
  LONG_FUEL:     { cmd: '0107\r', name: 'Long Fuel Trim', unit: '%',    parse: (d) => ((d[0] - 128) * 100 / 128).toFixed(1) },
  MAP:           { cmd: '010B\r', name: 'MAP (Boost)',     unit: 'kPa', parse: (d) => d[0].toFixed(0) },
  MAF:           { cmd: '0110\r', name: 'MAF',             unit: 'g/s', parse: (d) => ((d[0]*256 + d[1]) / 100).toFixed(2) },
  BATTERY:       { cmd: '0142\r', name: 'Battery',         unit: 'V',   parse: (d) => ((d[0]*256 + d[1]) / 1000).toFixed(2) },
};

export const parseOBD2Response = (raw, pid) => {
  try {
    // Strip spaces and uppercase
    let clean = raw.replace(/\s/g, '').toUpperCase();

    // Strip CAN frame headers if present — e.g. "7EA0", "7E80", "7E90"
    // These appear when ATH0 hasn't taken effect yet or adapter sends them anyway
    clean = clean.replace(/^7E[0-9A-F]{2}/i, '');

    // Strip ISO-TP length byte if present (single hex digit or byte before mode response)
    // e.g. "03410C1AF8" → length=03, then "410C1AF8"
    // Find the mode response marker directly
    const modeResp = '4' + pid.cmd[1]; // e.g. "41"
    const pidHex = pid.cmd.substring(2, 4).toUpperCase();
    const idx = clean.indexOf(modeResp + pidHex);
    if (idx === -1) return null;
    const dataHex = clean.substring(idx + 4);
    const dataBytes = dataHex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)).filter(n => !isNaN(n));
    if (!dataBytes || dataBytes.length === 0) return null;
    return pid.parse(dataBytes);
  } catch (e) {
    return null;
  }
};

export const encodeBLECommand = (cmd) => {
  // Convert string to base64 for BLE write
  return btoa(cmd);
};
