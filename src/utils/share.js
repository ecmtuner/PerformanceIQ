import { Share } from 'react-native';

export const shareRun = async ({ type, bracket, measuredTime, correctedTime, slope, delta, car }) => {
  // car can be a string "2019 BMW M3" or an object {year, make, model}
  let carLine = '';
  if (car) {
    if (typeof car === 'string') {
      carLine = `🚗 ${car}`;
    } else if (car.make) {
      carLine = `🚗 ${[car.year, car.make, car.model].filter(Boolean).join(' ')}`;
    }
  }

  const slopeNum = typeof slope === 'number' ? slope : parseFloat(slope);
  const slopeStr = `${slopeNum > 0 ? '+' : ''}${slopeNum}%`;

  const message = [
    '⚡ PerformanceIQ — Corrected Run',
    carLine,
    `📊 ${type}${bracket ? ` · ${bracket}` : ''}`,
    `⏱️  Raw:       ${measuredTime}s`,
    `✅ Corrected: ${correctedTime}s`,
    `📐 Slope: ${slopeStr}  (${delta}s difference)`,
    '',
    '📲 PerformanceIQ App',
  ].filter(Boolean).join('\n');

  await Share.share({ message });
};
