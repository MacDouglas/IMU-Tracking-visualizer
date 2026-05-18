/** Build 3×3 rotation matrix from unit quaternion [q0, q1, q2, q3] */
export function quatToMatrix(q0: number, q1: number, q2: number, q3: number): number[][] {
  return [
    [1 - 2*(q2*q2 + q3*q3),   2*(q1*q2 - q0*q3),       2*(q1*q3 + q0*q2)],
    [2*(q1*q2 + q0*q3),       1 - 2*(q1*q1 + q3*q3),   2*(q2*q3 - q0*q1)],
    [2*(q1*q3 - q0*q2),       2*(q2*q3 + q0*q1),       1 - 2*(q1*q1 + q2*q2)],
  ];
}

/** Compute fingertip position for 3D trail (vector [0, 0, 1.8] rotated by quaternion) */
export function tipPosition(q0: number, q1: number, q2: number, _q3: number): [number, number] {
  const tipX = 2 * (q1 * _q3 + q0 * q2) * 1.8;
  const tipY = 2 * (q2 * _q3 - q0 * q1) * 1.8;
  return [tipX, tipY];
}

/** Precompute all tip positions for a row array */
export function computeTipTrail(rows: { q0: number; q1: number; q2: number; q3: number }[]): [number, number][] {
  return rows.map(r => tipPosition(r.q0, r.q1, r.q2, r.q3));
}
