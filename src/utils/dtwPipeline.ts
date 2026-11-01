// utils/dtwPipeline.ts
//
// Orchestrates: process two TSV files (loadSession) → downsample → compute DTW
// Returns DtwComparisonData ready for the comparison panels.
//
// Downsampling rule (step floor(N/150), first 150 points, roll/pitch rounded
// to 0.1°) is fixed: the v5.1 control value 5190.9° is defined with it.

import type { DtwComparisonData, DtwResult, RecordingSummary } from '../types/dtw';
import { loadSession } from './sessionLoader';
import { dtw } from './imuProcessing';
import { computeDtw2D } from './dtwAlgorithm';

const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

function buildSummary(
  tsvContent: string,
  label: string,
  targetPoints: number = 150
): RecordingSummary {
  const s = loadSession(tsvContent);
  if (!s.ok) throw new Error(`${label}: ${s.error}`);
  const { rows, extras } = s;
  const N = rows.length;
  const step = Math.max(1, Math.floor(N / targetPoints));

  const idx: number[] = [];
  for (let i = 0; i < N; i += step) {
    idx.push(i);
    if (idx.length >= targetPoints) break;
  }

  const duration = rows[N - 1].time;
  const T = extras.trajectory;

  return {
    t: idx.map(i => r1(rows[i].time)),
    tn: idx.map(i => Math.round((rows[i].time / duration) * 1000) / 1000),
    roll: idx.map(i => r1(rows[i].angleX)),
    pitch: idx.map(i => r1(rows[i].angleY)),
    tipX: idx.map(i => r3(extras.tip.x[i])),
    tipY: idx.map(i => r3(extras.tip.y[i])),
    tipZ: idx.map(i => r3(extras.tip.z[i])),
    traj: T && {
      x: idx.map(i => r1(T.p[0][i])),
      y: idx.map(i => r1(T.p[1][i])),
      z: idx.map(i => r1(T.p[2][i])),
    },
    duration,
    label,
  };
}

/** N-dimensional DTW on the trajectory, rounded like computeDtw2D */
function trajectoryDtw(a: RecordingSummary, b: RecordingSummary): DtwResult | null {
  if (!a.traj || !b.traj) return null;
  const pts = (t: NonNullable<RecordingSummary['traj']>) => t.x.map((x, i) => [x, t.y[i], t.z[i]]);
  const r = dtw(pts(a.traj), pts(b.traj));
  return {
    distance: Math.round(r.distance * 10) / 10,
    normalized: Math.round(r.normalized * 100) / 100,
    path: r.path,
  };
}

/**
 * Run the full DTW comparison pipeline on two TSV files.
 *
 * @param tsv1 - Content of first TSV file
 * @param tsv2 - Content of second TSV file
 * @param label1 - Display name for file 1
 * @param label2 - Display name for file 2
 * @returns DtwComparisonData with both recordings and DTW results
 */
export function runDtwPipeline(
  tsv1: string,
  tsv2: string,
  label1: string = 'Запись 1',
  label2: string = 'Запись 2'
): DtwComparisonData {
  const rec1 = buildSummary(tsv1, label1);
  const rec2 = buildSummary(tsv2, label2);

  const dtwEuler = computeDtw2D(rec1.roll, rec1.pitch, rec2.roll, rec2.pitch);
  const dtwTip = computeDtw2D(rec1.tipX, rec1.tipY, rec2.tipX, rec2.tipY);
  const dtwTraj = trajectoryDtw(rec1, rec2);

  return { rec1, rec2, dtwEuler, dtwTip, dtwTraj };
}
