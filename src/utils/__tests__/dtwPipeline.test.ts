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

test('Displacement mode в одной из записей: углы и tip сравниваются, траектория — нет', () => {
  const r = runDtwPipeline(load('wrist_articulation.txt'), load('wrist_articulation_v2.txt'));
  expect(r.rec1.traj).toBeNull();
  expect(r.rec2.traj).not.toBeNull();
  expect(r.dtwTraj).toBeNull();
  expect(r.dtwTip.path.length).toBeGreaterThan(0);
});

test('DTW траектории: запись сама с собой = 0, диагональный путь', () => {
  const sq = load('square_20hz_100hz.txt');
  const r = runDtwPipeline(sq, sq);
  expect(r.dtwTraj).not.toBeNull();
  expect(r.dtwTraj!.distance).toBe(0);
  expect(r.dtwTraj!.path.every(([i, j]) => i === j)).toBe(true);
});

test('DTW траектории: квадрат vs вращения > 0, путь от начала до конца', () => {
  const r = runDtwPipeline(load('square_20hz_100hz.txt'), load('wrist_articulation_v2.txt'));
  const d = r.dtwTraj!;
  expect(d.distance).toBeGreaterThan(0);
  expect(d.path[0]).toEqual([0, 0]);
  expect(d.path[d.path.length - 1]).toEqual([r.rec1.traj!.x.length - 1, r.rec2.traj!.x.length - 1]);
});

test('ошибка загрузки одной записи → понятное сообщение с её именем', () => {
  expect(() => runDtwPipeline('', load('square_20hz_100hz.txt'), 'a.txt', 'b.txt')).toThrow(/a\.txt/);
});
