import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parseTsv, computeTrajectory } from '../imuProcessing';

// Положить файлы проекта в fixtures/ (square_20hz_100hz.txt, wrist_articulation_v2.txt, wrist_articulation.txt)
const load = (f: string) => parseTsv(readFileSync(`fixtures/${f}`, 'utf8'));
const summary = (f: string) => {
  const T = computeTrajectory(load(f)), n = T.p[0].length;
  return {
    lever: Math.hypot(...T.leverM) * 100,
    still: T.stationary.reduce((s, v) => s + v, 0) / n,
    ext: T.p.map(x => Math.max(...x) - Math.min(...x)),
    ret: Math.hypot(T.p[0][n - 1], T.p[1][n - 1], T.p[2][n - 1]),
  };
};

describe('единый алгоритм траектории', () => {
  test('квадрат 200 мм', () => {
    const s = summary('square_20hz_100hz.txt');
    expect(s.lever).toBeCloseTo(7.71, 1);
    expect(s.still).toBeCloseTo(0.513, 2);
    expect(s.ext[0]).toBeCloseTo(323.0, 0);
    expect(s.ext[1]).toBeCloseTo(292.3, 0);
    expect(s.ret).toBeCloseTo(43.3, 0);
  });
  test('вращения кулака', () => {
    const s = summary('wrist_articulation_v2.txt');
    expect(s.lever).toBeCloseTo(8.41, 1);
    expect(s.ext[1]).toBeCloseTo(500.1, 0);
    expect(s.ret).toBeCloseTo(66.4, 0);
  });
  test('Displacement mode блокируется', () => {
    const r = load('wrist_articulation.txt');
    expect(r.displacementMode).toBe(true);
    expect(() => computeTrajectory(r)).toThrow();
  });
});
