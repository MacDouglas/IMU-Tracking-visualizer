// types/dtw.ts

export interface DtwResult {
  /** Total DTW distance */
  distance: number;
  /** Normalized distance (distance / path length) */
  normalized: number;
  /** Warping path: array of [index1, index2] pairs */
  path: [number, number][];
}

export interface RecordingSummary {
  /** Real time in seconds */
  t: number[];
  /** Normalized time 0..1 (for overlaying recordings of different length) */
  tn: number[];
  /** Roll = AngleX (°) */
  roll: number[];
  /** Pitch = AngleY (°) */
  pitch: number[];
  /** Tip X from quaternion rotation of [0,0,1.8] */
  tipX: number[];
  /** Tip Y from quaternion rotation of [0,0,1.8] */
  tipY: number[];
  /** Duration in seconds */
  duration: number;
  /** Label for display */
  label: string;
}

export interface DtwComparisonData {
  rec1: RecordingSummary;
  rec2: RecordingSummary;
  /** DTW on (Roll, Pitch) */
  dtwEuler: DtwResult;
  /** DTW on (tipX, tipY) */
  dtwTip: DtwResult;
}
