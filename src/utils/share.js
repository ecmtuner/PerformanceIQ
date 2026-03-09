import { Share } from 'react-native';

export const shareRun = async ({ type, bracket, measuredTime, correctedTime, slope, delta, car }) => {
  const carLine = car ? `🚗 ${car.year} ${car.make} ${car.model}` : '';
  const message = [
    '⚡ PerformanceIQ — Corrected Run',
    carLine,
    `📊 Type: ${type}${bracket ? ` (${bracket})` : ''}`,
    `⏱️  Raw Time: ${measuredTime}s`,
    `✅ Corrected: ${correctedTime}s`,
    `📐 Slope: ${slope > 0 ? '+' : ''}${slope}%  (${delta}s difference)`,
    '',
    '📲 PerformanceIQ App',
  ].filter(Boolean).join('\n');

  await Share.share({ message });
};
