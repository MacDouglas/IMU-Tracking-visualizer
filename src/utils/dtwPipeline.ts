// utils/dtwPipeline.ts
//
// Orchestrates: parse two TSV files → downsample → compute DTW
// Returns DtwComparisonData ready for all 7 v4 panels.

import type { DtwComparisonData, RecordingSummary } from '../types/dtw';
import { parseTSV, fixTimestamps } from './tsvParser';
import { computeTipPosition } from './signalProcessing';
import { computeDtw2D } from './dtwAlgorithm';

function buildSummary(
  tsvContent: string,
  label: string,
  targetPoints: number = 150
): RecordingSummary {
  const rows = fixTimestamps(parseTSV(tsvContent));
  const N = rows.length;
  const step = Math.max(1, Math.floor(N / targetPoints));

  const idx: number[] = [];
  for (let i = 0; i < N; i += step) {
    idx.push(i);
    if (idx.length >= targetPoints) break;
  }

  const duration = rows[N - 1].time;

  const t = idx.map(i => Math.round(rows[i].time * 10) / 10);
  const tn = idx.map(i => Math.round((rows[i].time / duration) * 1000) / 1000);
  const roll = idx.map(i => Math.round(rows[i].angleX * 10) / 10);
  const pitch = idx.map(i => Math.round(rows[i].angleY * 10) / 10);

  const tipX: number[] = [];
  const tipY: number[] = [];
  for (const i of idx) {
    const r = rows[i];
    const [tx, ty] = computeTipPosition(r.q0, r.q1, r.q2, r.q3);
    tipX.push(Math.round(tx * 1000) / 1000);
    tipY.push(Math.round(ty * 1000) / 1000);
  }

  return { t, tn, roll, pitch, tipX, tipY, duration, label };
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

  return { rec1, rec2, dtwEuler, dtwTip };
}
