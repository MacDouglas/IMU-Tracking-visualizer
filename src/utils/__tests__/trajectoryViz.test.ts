import { describe, expect, test } from 'vitest';
import { niceStep, runs, modeArrays } from '../trajectoryViz';
import type { VizTrajectory } from '../../types/imu';

describe('niceStep', () => {
  test.each([
    [0.7, 1], [1, 1], [1.2, 2], [3, 5], [7, 10], [40, 50], [107.7, 200], [166.7, 200], [250, 500],
  ])('%f → %f', (x, step) => expect(niceStep(x)).toBe(step));
  test('ноль и NaN → 1', () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(NaN)).toBe(1);
  });
});

test('runs: серии единиц [b, e)', () => {
  expect(runs([1, 1, 0, 0, 1, 0, 1, 1, 1])).toEqual([[0, 2], [4, 5], [6, 9]]);
  expect(runs([0, 0])).toEqual([]);
  expect(runs([])).toEqual([]);
});

test('modeArrays: итог / перенос / поворот', () => {
  const a = (v: number) => [v];
  const tr: VizTrajectory = {
    trajX: a(1), trajY: a(2), trajZ: a(3),
    baseX: a(4), baseY: a(5), baseZ: a(6),
    rotX: a(7), rotY: a(8), rotZ: a(9),
    still: a(1), leverM: [0, 0, 0],
  };
  expect(modeArrays(tr, 'total')).toEqual([[1], [2], [3]]);
  expect(modeArrays(tr, 'base')).toEqual([[4], [5], [6]]);
  expect(modeArrays(tr, 'rot')).toEqual([[7], [8], [9]]);
});
