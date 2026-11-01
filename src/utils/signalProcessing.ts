import type { SensorRow } from './tsvParser';
import { DT, derivativeDt, type SessionExtras, type Trajectory } from './imuProcessing';
import type { ImuRecording, ImuDerived, ImuVisualizationData } from '../types/imu';

// ─── Columnar IMU processing for the visualization panels ────────────────────

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
