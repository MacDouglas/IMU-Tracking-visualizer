import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { runDtwPipeline } from '../dtwPipeline';

const load = (f: string) => readFileSync(`fixtures/${f}`, 'utf8');

test('DTW roll/pitch v1 vs v2: контрольное значение v5.1', () => {
  const r = runDtwPipeline(load('wrist_articulation.txt'), load('wrist_articulation_v2.txt'));
  expect(r.dtwEuler.distance).toBeCloseTo(5190.9, 1);
  expect(r.dtwEuler.normalized).toBeCloseTo(23.81, 2);
  expect(r.dtwEuler.path.length).toBe(218);
  expect(r.rec1.duration).toBeCloseTo((3696 - 1) * 0.01, 6);
});
