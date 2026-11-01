import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { welchPsd, WELCH_WIN } from '../spectrum';
import { DT, motionSpan } from '../imuProcessing';
import { loadSession } from '../sessionLoader';
import { buildVizData } from '../signalProcessing';

const peak = (psd: { freq: number; psd: number }[]) => psd.reduce((a, b) => (b.psd > a.psd ? b : a));

test('синус 10 Гц → пик у 10 Гц (разрешение 0,39 Гц)', () => {
  const x = Array.from({ length: 1000 }, (_, i) => Math.sin(2 * Math.PI * 10 * i * DT));
  const p = welchPsd(x);
  expect(Math.abs(peak(p).freq - 10)).toBeLessThan(0.4);
  expect(p[p.length - 1].freq).toBeLessThanOrEqual(20);
});

test('короче одного окна → пусто', () => {
  expect(welchPsd(new Array(WELCH_WIN - 1).fill(0))).toEqual([]);
  expect(welchPsd(new Array(WELCH_WIN).fill(0)).length).toBeGreaterThan(0);
});

test('квадрат: режим «только движение» = [550, 1298), хватает на окно Welch', () => {
  const s = loadSession(readFileSync('fixtures/square_20hz_100hz.txt', 'utf8'));
  if (!s.ok) throw new Error(s.error);
  const span = motionSpan(s.extras.trajectory!.stationary)!;
  expect(span).toEqual([550, 1298]);
  expect(welchPsd(s.rows.slice(...span).map(r => r.asX)).length).toBeGreaterThan(0);
});

test('accMotionHoriz: есть для обычной записи, null в Displacement mode', () => {
  for (const [f, expectNull] of [['square_20hz_100hz.txt', false], ['wrist_articulation.txt', true]] as const) {
    const s = loadSession(readFileSync(`fixtures/${f}`, 'utf8'));
    if (!s.ok) throw new Error(s.error);
    const v = buildVizData(s.rows, s.extras, 120);
    expect(v.derived.accMotionHoriz === null).toBe(expectNull);
    if (!expectNull) expect(v.derived.accMotionHoriz!.length).toBe(v.indices.length);
  }
});
