import { BleManager } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';

export const bleManager = new BleManager();

export const requestBLEPermissions = async () => {
  if (Platform.OS === 'android') {
    const grants = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(grants).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
  }
  return true; // iOS handles via Info.plist
};

// ELM327 / OBD2 known service UUIDs
export const OBD2_SERVICES = [
  'FFF0', 'FFE0', 'FFE1',   // Common ELM327 BLE clones
  '18F0', 'BEEF',            // Veepeak / generic
  '0000FFF0-0000-1000-8000-00805F9B34FB',
  '0000FFE0-0000-1000-8000-00805F9B34FB',
];

export const OBD2_CHARACTERISTICS = [
  'FFF1', 'FFF2', 'FFE1',
  '0000FFF1-0000-1000-8000-00805F9B34FB',
  '0000FFE1-0000-1000-8000-00805F9B34FB',
];

// Dragy GPS device prefix
export const DRAGY_PREFIX = 'DRGUS';

// Nordic UART Service (common for GPS modules)
export const NORDIC_UART_SERVICE = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
export const NORDIC_UART_TX = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';
export const NORDIC_UART_RX = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';
