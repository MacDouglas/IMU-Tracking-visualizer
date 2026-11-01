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
  /** Tip of [0,0,1.8] rotated by R from Euler angles (3rd column of R × 1.8) */
  tipX: number[];
  tipY: number[];
  tipZ: number[];
  /** Trajectory p (mm, relative to start); null in Displacement mode or for too-short recordings */
  traj: { x: number[]; y: number[]; z: number[] } | null;
  /** Duration in seconds */
  duration: number;
  /** Label for display */
  label: string;
}

export interface DtwComparisonData {
  rec1: RecordingSummary;
  rec2: RecordingSummary;
  /** DTW on (Roll, Pitch), ° */
  dtwEuler: DtwResult;
  /** DTW on (tipX, tipY), scene units */
  dtwTip: DtwResult;
  /** DTW on trajectory (x, y, z), mm; null when either recording has no trajectory */
  dtwTraj: DtwResult | null;
}
