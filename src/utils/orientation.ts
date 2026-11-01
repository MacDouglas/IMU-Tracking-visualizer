// utils/orientation.ts — R (sensor → room) to three.js orientation

import * as THREE from 'three';

/**
 * Sample i of R (sensor → room, Z up; from Euler angles, v5.1 §5.1) as a three.js
 * quaternion. three.js is Y up, so the room frame is rotated by C: (x, y, z) → (x, z, −y),
 * i.e. M = C·R with rows R0, R2, −R1. C is a proper rotation (det = +1), so M is too.
 */
export function quaternionFromR(R: ArrayLike<number>, i: number): THREE.Quaternion {
  const o = 9 * i;
  const m = new THREE.Matrix4().set(
    R[o],      R[o + 1],  R[o + 2],  0,
    R[o + 6],  R[o + 7],  R[o + 8],  0,
    -R[o + 3], -R[o + 4], -R[o + 5], 0,
    0,         0,         0,         1,
  );
  return new THREE.Quaternion().setFromRotationMatrix(m);
}
