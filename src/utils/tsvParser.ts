export interface SensorRow {
  time: number;          // relative seconds from first row
  deviceName: string;
  accX: number; accY: number; accZ: number;      // g
  asX: number;  asY: number;  asZ: number;       // °/s
  angleX: number; angleY: number; angleZ: number; // °
  hX: number;   hY: number;   hZ: number;        // uT
  trajX: number; trajY: number; trajZ: number;   // mm
  speedX: number; speedY: number; speedZ: number; // mm/s
  q0: number; q1: number; q2: number; q3: number;
  temperature: number;
  version: number;
  battery: number;
}

/** Parse WitMotion TSV string → typed rows with relative timestamps */
export function parseTSV(raw: string): SensorRow[] {
  const lines = raw.trim().split('\n').filter(l => l.trim() && !l.startsWith('time'));
  if (lines.length === 0) return [];

  const parseTime = (s: string): number => {
    // Format: "2026-3-25 0:12:55.983"
    return new Date(s).getTime();
  };

  const rawRows = lines.map(line => {
    const cols = line.split('\t');
    return cols;
  });

  const t0 = parseTime(rawRows[0][0]);

  return rawRows.map(cols => {
    const n = (i: number) => { const v = parseFloat(cols[i]); return isNaN(v) ? NaN : v; };
    return {
      time:        (parseTime(cols[0]) - t0) / 1000,
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

/** Fix BLE batching: when dt=0, use 0.01s */
export function fixTimestamps(rows: SensorRow[]): SensorRow[] {
  return rows.map((row, i) => {
    if (i === 0) return row;
    const dt = row.time - rows[i - 1].time;
    if (dt === 0) return { ...row, time: rows[i - 1].time + 0.01 };
    return row;
  });
}

/** Downsample to ~targetCount points for visualization */
export function downsample<T>(arr: T[], targetCount: number): T[] {
  if (arr.length <= targetCount) return arr;
  const step = Math.floor(arr.length / targetCount);
  return arr.filter((_, i) => i % step === 0);
}
