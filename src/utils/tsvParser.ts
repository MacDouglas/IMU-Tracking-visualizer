import { DT } from './imuProcessing';

export interface SensorRow {
  time: number;          // seconds, i·DT (file timestamps are not used, see parseTSV)
  deviceName: string;
  accX: number; accY: number; accZ: number;      // g
  asX: number;  asY: number;  asZ: number;       // °/s
  angleX: number; angleY: number; angleZ: number; // °
  hX: number;   hY: number;   hZ: number;        // uT
  trajX: number; trajY: number; trajZ: number;   // mm
  speedX: number; speedY: number; speedZ: number; // mm/s
  q0: number; q1: number; q2: number; q3: number; // ~1.5 Hz, reference only: orientation comes from angles (v5.1)
  temperature: number;
  version: number;
  battery: number;
}

/**
 * Parse WitMotion TSV string → typed rows.
 * time[i] = i·DT: file timestamps are uneven because of BLE batching
 * (~68% of rows share a timestamp), and the sensor runs at a fixed 100 Hz.
 */
export function parseTSV(raw: string): SensorRow[] {
  const lines = raw.trim().split('\n').filter(l => l.trim() && !l.startsWith('time'));
  if (lines.length === 0) return [];

  const rawRows = lines.map(line => line.split('\t'));

  return rawRows.map((cols, row) => {
    const n = (i: number) => { const v = parseFloat(cols[i]); return isNaN(v) ? NaN : v; };
    return {
      time:        row * DT,
      deviceName:  cols[1] ?? '',
      accX: n(2),  accY: n(3),  accZ: n(4),
      asX:  n(5),  asY:  n(6),  asZ:  n(7),
      angleX: n(8), angleY: n(9), angleZ: n(10),
      hX: n(11),   hY: n(12),   hZ: n(13),
      trajX: n(14), trajY: n(15), trajZ: n(16),
      speedX: n(17), speedY: n(18), speedZ: n(19),
      q0: n(20), q1: n(21), q2: n(22), q3: n(23),
      temperature: n(24),
      version:     n(25),
      battery:     n(26),
    } as SensorRow;
  });
}
