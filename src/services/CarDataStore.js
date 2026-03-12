// Global store for OBD2-connected car data
// Set when OBD2 connects and VIN is decoded; read by GPS Performance screen

let _car = null;

export const setConnectedCar = (carData) => { _car = carData; };
export const getConnectedCar = () => _car;
export const clearConnectedCar = () => { _car = null; };

// Decode VIN using NHTSA free API
export const decodeVIN = async (vin) => {
  if (!vin || vin.length < 10) return null;
  try {
    const resp = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`);
    const json = await resp.json();
    const get = (var_) => json.Results?.find(r => r.Variable === var_)?.Value || '';
    return {
      vin,
      make:  get('Make'),
      model: get('Model'),
      year:  get('Model Year'),
      engine: `${get('Displacement (L)')}L ${get('Engine Number of Cylinders')}-cyl`,
      fuel:   get('Fuel Type - Primary'),
      body:   get('Body Class'),
    };
  } catch { return null; }
};

// Parse VIN from OBD2 Mode 09 PID 02 response
// ELM327 returns multi-frame ISO-TP response — with headers OFF (ATH0) it looks like:
//   49 02 01 31 47 31 46 42    ← frame 1 (byte 01 = frame index, rest = VIN bytes 1-7)
//   49 02 02 33 45 4C 35 30    ← frame 2
//   49 02 03 33 36 36 36 39    ← frame 3
// With headers ON (ATH1) there may be ISO-TP prefixes like "014\r" or "10 14" before data
// Strategy: grab ALL hex from lines containing 4902, strip frame/header tokens, decode ASCII
export const parseVINFromOBD2 = (rawLines) => {
  try {
    if (!rawLines || rawLines.length === 0) return null;

    // Collect all hex bytes from lines that contain 4902 data
    let vinBytes = [];

    for (const line of rawLines) {
      const clean = line.replace(/\s/g, '').toUpperCase();

      // Find 4902XX marker and grab everything after it
      // XX is the frame index byte (01, 02, 03...) — skip it, it's not VIN data
      const match = clean.match(/4902([0-9A-F]{2})([0-9A-F]+)/);
      if (match) {
        // match[1] = frame index (skip), match[2] = actual VIN hex bytes
        const hexData = match[2];
        const bytes = hexData.match(/.{1,2}/g) || [];
        bytes.forEach(b => {
          const val = parseInt(b, 16);
          if (!isNaN(val)) vinBytes.push(val);
        });
      }
    }

    if (vinBytes.length === 0) return null;

    // Convert bytes to ASCII, keep only valid VIN characters
    const vin = vinBytes
      .map(b => String.fromCharCode(b))
      .join('')
      .replace(/[^A-HJ-NPR-Z0-9]/gi, '')
      .slice(0, 17);

    return vin.length >= 11 ? vin : null;
  } catch { return null; }
};
