import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parseTsv, processSession, motionSpan, derivativeDt } from '../imuProcessing';
const load = (f: string) => parseTsv(readFileSync(`fixtures/${f}`, 'utf8'));
test('processSession: Displacement mode не падает, траектории нет', () => {
  const s = processSession(load('wrist_articulation.txt'));
  expect(s.displacementMode).toBe(true); expect(s.trajectory).toBeNull(); expect(s.tip.x.length).toBe(3696);
});
test('processSession: квадрат', () => {
  const s = processSession(load('square_20hz_100hz.txt'));
  expect(s.trajectory).not.toBeNull();
  const span = motionSpan(s.trajectory!.stationary)!;
  expect(span[0]).toBeGreaterThan(400);            // 5 с покоя в начале
  expect(derivativeDt(Float64Array.from([0, 1, 2]))[1]).toBeCloseTo(100);
});
