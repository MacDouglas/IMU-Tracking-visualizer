import type { SensorRow } from './tsvParser';
import { DT, derivativeDt, type SessionExtras, type Trajectory } from './imuProcessing';
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

/**
 * Remove ±360° jumps (AngleZ wraps at ±180°) so the angle is continuous.
 * NaN samples are passed through and don't affect the offset.
 */
export function unwrapDeg(x: ArrayLike<number>): Float64Array {
  const out = new Float64Array(x.length);
  let offset = 0;
  let prev = NaN;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (Number.isFinite(v) && Number.isFinite(prev)) {
      const d = v - prev;
      if (d > 180) offset -= 360;
      else if (d < -180) offset += 360;
    }
    if (Number.isFinite(v)) prev = v;
    out[i] = v + offset;
  }
  return out;
}

/** Compute derived arrays at full rate: gyroMag, accHoriz, tip (from R), angle rates. */
export function computeDerived(rec: ImuRecording, extras: SessionExtras): ImuDerived {
  const N = rec.length;
  const gyroMag = new Array<number>(N);
  const accHoriz = new Array<number>(N);

  for (let i = 0; i < N; i++) {
    gyroMag[i] = Math.sqrt(rec.gyroX[i] ** 2 + rec.gyroY[i] ** 2 + rec.gyroZ[i] ** 2);
    accHoriz[i] = Math.sqrt(rec.accX[i] ** 2 + rec.accY[i] ** 2);
  }

  const rate = (angle: number[]) => Array.from(derivativeDt(unwrapDeg(angle)));

  return {
    gyroMag,
    accHoriz,
    accMotionHoriz: extras.accMotionHorizG ? Array.from(extras.accMotionHorizG) : null,
    tipX: Array.from(extras.tip.x),
    tipY: Array.from(extras.tip.y),
    tipZ: Array.from(extras.tip.z),
    rateX: rate(rec.angleX),
    rateY: rate(rec.angleY),
    rateZ: rate(rec.angleZ),
  };
}

/**
 * Indices of every step-th sample spanning the whole recording, at most targetPoints of them.
 * step = ceil(length / targetPoints) so the tail isn't cut off; the last sample is always included.
 */
export function downsampleIndices(length: number, targetPoints: number): number[] {
  if (length <= 0) return [];
  const step = Math.max(1, Math.ceil(length / targetPoints));
  const indices: number[] = [];
  for (let i = 0; i < length; i += step) indices.push(i);
  const last = length - 1;
  if (indices[indices.length - 1] !== last) {
    if (indices.length < targetPoints) indices.push(last);
    else indices[indices.length - 1] = last;
  }
  return indices;
}

/** Downsample ImuRecording + ImuDerived + trajectory to targetPoints for rendering. */
function downsampleColumnar(
  rec: ImuRecording,
  derived: ImuDerived,
  trajectory: Trajectory | null,
  targetPoints: number = 120
): ImuVisualizationData {
  const indices = downsampleIndices(rec.length, targetPoints);

  const pick = (arr: ArrayLike<number>) => indices.map(i => arr[i]);

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
      accMotionHoriz: derived.accMotionHoriz && pick(derived.accMotionHoriz),
      tipX: pick(derived.tipX),
      tipY: pick(derived.tipY),
      tipZ: pick(derived.tipZ),
      rateX: pick(derived.rateX),
      rateY: pick(derived.rateY),
      rateZ: pick(derived.rateZ),
    },
    trajectory: trajectory && {
      trajX: pick(trajectory.p[0]), trajY: pick(trajectory.p[1]), trajZ: pick(trajectory.p[2]),
      rotX: pick(trajectory.rot[0]), rotY: pick(trajectory.rot[1]), rotZ: pick(trajectory.rot[2]),
      baseX: pick(trajectory.base[0]), baseY: pick(trajectory.base[1]), baseZ: pick(trajectory.base[2]),
      still: pick(trajectory.stationary),
      leverM: trajectory.leverM,
    },
    indices,
  };
}

/**
 * Convert SensorRow[] + SessionExtras → ImuVisualizationData.
 * All full-rate processing happens before downsampling to targetPoints;
 * every array is sampled at the same `indices`, so currentIndex matches across panels.
 */
export function buildVizData(rows: SensorRow[], extras: SessionExtras, targetPoints = 120): ImuVisualizationData {
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
    sampleRate: 1 / DT,
  };

  const derived = computeDerived(rec, extras);
  return downsampleColumnar(rec, derived, extras.trajectory, targetPoints);
}
