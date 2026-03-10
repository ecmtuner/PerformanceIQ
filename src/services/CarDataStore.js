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

// Parse VIN from OBD2 Mode 09 response
// Raw response lines like: "49 02 01 XX XX XX..." (multiple frames)
export const parseVINFromOBD2 = (rawLines) => {
  try {
    // Combine all hex bytes from Mode 09 PID 02 response
    const allHex = rawLines
      .join('')
      .replace(/\s/g, '')
      .replace(/49020[0-9]/g, '') // strip header bytes
      .replace(/^.*?4902/, '4902') // find start
      .replace(/4902/, '');
    // Convert hex pairs to ASCII, skip non-printable
    const vin = allHex.match(/.{2}/g)
      ?.map(h => String.fromCharCode(parseInt(h, 16)))
      .filter(c => c >= '0' && c <= 'z' && c !== ':')
      .join('')
      .replace(/[^A-HJ-NPR-Z0-9]/gi, '')
      .slice(0, 17);
    return vin?.length >= 11 ? vin : null;
  } catch { return null; }
};
