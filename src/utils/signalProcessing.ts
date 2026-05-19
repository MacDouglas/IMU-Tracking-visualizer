import type { SensorRow } from './tsvParser';
import type { ImuRecording, ImuDerived, ImuVisualizationData } from '../types/imu';

/** √(AsX² + AsY² + AsZ²) — gyroscope magnitude °/s */
export function gyroMagnitude(row: SensorRow): number {
  return Math.sqrt(row.asX ** 2 + row.asY ** 2 + row.asZ ** 2);
}

/** √(AccX² + AccY²) — horizontal acceleration (removes gravity) */
export function horizontalAccMagnitude(row: SensorRow): number {
  return Math.sqrt(row.accX ** 2 + row.accY ** 2);
}

/** Numerical derivative: angle_rate[i] = (angle[i] - angle[i-1]) / dt */
export function derivative(values: number[], times: number[]): number[] {
  return values.map((v, i) => {
    if (i === 0) return 0;
    const dt = times[i] - times[i - 1];
    return dt > 0 ? (v - values[i - 1]) / dt : 0;
  });
}

// ─── Columnar IMU processing (for new 3D panels) ─────────────────────────────

/**
 * Rotate vector [0, 0, length] by quaternion → tip position in world frame.
 * q0=w, q1=x, q2=y, q3=z
 */
export function computeTipPosition(
  q0: number, q1: number, q2: number, q3: number,
  length: number = 1.8
): [number, number, number] {
  const tipX = 2 * (q1 * q3 + q0 * q2) * length;
  const tipY = 2 * (q2 * q3 - q0 * q1) * length;
  const tipZ = (1 - 2 * (q1 * q1 + q2 * q2)) * length;
  return [tipX, tipY, tipZ];
}

/**
 * Build 3x3 rotation matrix from quaternion.
 * Returns flat array [r00, r01, r02, r10, r11, r12, r20, r21, r22].
 */
export function quaternionToMatrix(
  q0: number, q1: number, q2: number, q3: number
): number[] {
  return [
    1 - 2 * (q2 * q2 + q3 * q3), 2 * (q1 * q2 - q0 * q3), 2 * (q1 * q3 + q0 * q2),
    2 * (q1 * q2 + q0 * q3), 1 - 2 * (q1 * q1 + q3 * q3), 2 * (q2 * q3 - q0 * q1),
    2 * (q1 * q3 - q0 * q2), 2 * (q2 * q3 + q0 * q1), 1 - 2 * (q1 * q1 + q2 * q2),
  ];
}

/** Compute derived arrays (gyroMag, accHoriz, tip positions) from ImuRecording. */
export function computeDerived(rec: ImuRecording): ImuDerived {
  const N = rec.length;
  const gyroMag = new Array<number>(N);
  const accHoriz = new Array<number>(N);
  const tipX = new Array<number>(N);
  const tipY = new Array<number>(N);
  const tipZ = new Array<number>(N);

  for (let i = 0; i < N; i++) {
    gyroMag[i] = Math.sqrt(rec.gyroX[i] ** 2 + rec.gyroY[i] ** 2 + rec.gyroZ[i] ** 2);
    accHoriz[i] = Math.sqrt(rec.accX[i] ** 2 + rec.accY[i] ** 2);
    const [tx, ty, tz] = computeTipPosition(rec.q0[i], rec.q1[i], rec.q2[i], rec.q3[i]);
    tipX[i] = tx;
    tipY[i] = ty;
    tipZ[i] = tz;
  }

  return { gyroMag, accHoriz, tipX, tipY, tipZ };
}

/** Downsample ImuRecording + ImuDerived to targetPoints for rendering. */
function downsampleColumnar(
  rec: ImuRecording,
  derived: ImuDerived,
  targetPoints: number = 120
): ImuVisualizationData {
  const step = Math.max(1, Math.floor(rec.length / targetPoints));
  const indices: number[] = [];
  for (let i = 0; i < rec.length; i += step) {
    indices.push(i);
    if (indices.length >= targetPoints) break;
  }

  const pick = (arr: number[]) => indices.map(i => arr[i]);

  return {
    recording: {
      t: pick(rec.t),
      accX: pick(rec.accX), accY: pick(rec.accY), accZ: pick(rec.accZ),
      gyroX: pick(rec.gyroX), gyroY: pick(rec.gyroY), gyroZ: pick(rec.gyroZ),
      angleX: pick(rec.angleX), angleY: pick(rec.angleY), angleZ: pick(rec.angleZ),
      q0: pick(rec.q0), q1: pick(rec.q1), q2: pick(rec.q2), q3: pick(rec.q3),
      length: indices.length,
      duration: rec.duration,
      sampleRate: rec.sampleRate,
    },
    derived: {
      gyroMag: pick(derived.gyroMag),
      accHoriz: pick(derived.accHoriz),
      tipX: pick(derived.tipX),
      tipY: pick(derived.tipY),
      tipZ: pick(derived.tipZ),
    },
    indices,
  };
}

/**
 * Convert SensorRow[] → ImuVisualizationData (bridge for new 3D panels).
 * Downsamples to targetPoints.
 */
export function buildVizData(rows: SensorRow[], targetPoints = 120): ImuVisualizationData {
  const N = rows.length;
  const duration = rows[N - 1].time;

  const rec: ImuRecording = {
    t:      rows.map(r => r.time),
    angleX: rows.map(r => r.angleX),
    angleY: rows.map(r => r.angleY),
    angleZ: rows.map(r => r.angleZ),
    q0:     rows.map(r => r.q0),
    q1:     rows.map(r => r.q1),
    q2:     rows.map(r => r.q2),
    q3:     rows.map(r => r.q3),
    gyroX:  rows.map(r => r.asX),
    gyroY:  rows.map(r => r.asY),
    gyroZ:  rows.map(r => r.asZ),
    accX:   rows.map(r => r.accX),
    accY:   rows.map(r => r.accY),
    accZ:   rows.map(r => r.accZ),
    length: N,
    duration,
    sampleRate: duration > 0 ? Math.round(N / duration) : 100,
  };

  const derived = computeDerived(rec);
  return downsampleColumnar(rec, derived, targetPoints);
}
