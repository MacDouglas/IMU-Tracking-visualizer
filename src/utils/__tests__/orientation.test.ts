import { expect, test } from 'vitest';
import * as THREE from 'three';
import { quaternionFromR } from '../orientation';
import { rotationsFromEuler } from '../imuProcessing';

const R1 = (roll: number, pitch: number, yaw: number) =>
  rotationsFromEuler([Float64Array.of(roll), Float64Array.of(pitch), Float64Array.of(yaw)]);

/** Sensor-axis vector → three.js world via quaternionFromR */
const toThree = (R: Float64Array, v: [number, number, number]) =>
  new THREE.Vector3(...v).applyQuaternion(quaternionFromR(R, 0));

/** Same vector via R then C: room (x, y, z) → three (x, z, −y) */
const expected = (R: Float64Array, [x, y, z]: [number, number, number]) => {
  const w = [0, 1, 2].map(r => R[3 * r] * x + R[3 * r + 1] * y + R[3 * r + 2] * z);
  return new THREE.Vector3(w[0], w[2], -w[1]);
};

test('нулевые углы: нормаль к тыльной стороне кисти (Z датчика) смотрит вверх (+Y three)', () => {
  const v = toThree(R1(0, 0, 0), [0, 0, 1]);
  expect(v.x).toBeCloseTo(0, 9);
  expect(v.y).toBeCloseTo(1, 9);
  expect(v.z).toBeCloseTo(0, 9);
});

test.each([
  [30, 0, 0], [0, 40, 0], [0, 0, 120], [-100, 70, -170], [84, -69, 179],
])('roll=%f pitch=%f yaw=%f: поворот = C·R для всех трёх осей датчика', (roll, pitch, yaw) => {
  const R = R1(roll, pitch, yaw);
  for (const axis of [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as [number, number, number][]) {
    const got = toThree(R, axis), want = expected(R, axis);
    expect(got.distanceTo(want)).toBeLessThan(1e-9);
  }
});
