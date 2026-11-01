import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildVizData, unwrapDeg, downsampleIndices } from '../signalProcessing';
import { loadSession } from '../sessionLoader';

const session = (f: string) => {
  const s = loadSession(readFileSync(`fixtures/${f}`, 'utf8'));
  if (!s.ok) throw new Error(s.error);
  return s;
};

describe('unwrapDeg', () => {
  test('переход через ±180° убирается', () => {
    expect(Array.from(unwrapDeg([170, 179, -179, -170]))).toEqual([170, 179, 181, 190]);
    expect(Array.from(unwrapDeg([-170, -179, 179]))).toEqual([-170, -179, -181]);
  });
  test('NaN пропускается и не сбивает смещение', () => {
    const u = unwrapDeg([179, NaN, -179]);
    expect(u[1]).toBeNaN();
    expect(u[2]).toBe(181);
  });
});

describe('buildVizData', () => {
  test('квадрат: все массивы по одним индексам, tip из R, траектория', () => {
    const { rows, extras } = session('square_20hz_100hz.txt');
    const v = buildVizData(rows, extras, 120);
    const idx = v.indices;
    expect(idx).toEqual(downsampleIndices(rows.length, 120));
    expect(v.recording.t).toEqual(idx.map(i => i * 0.01));
    expect(v.recording.sampleRate).toBe(100);
    expect(v.derived.tipX).toEqual(idx.map(i => extras.tip.x[i]));
    expect(v.derived.rateX.length).toBe(idx.length);
    const T = extras.trajectory!;
    expect(v.trajectory!.trajY).toEqual(idx.map(i => T.p[1][i]));
    expect(v.trajectory!.still).toEqual(idx.map(i => T.stationary[i]));
    expect(v.trajectory!.leverM).toEqual(T.leverM);
  });

  test('tip из R совпадает со свежим кватернионом (≤ 0,018 при L = 1)', () => {
    const { rows, extras } = session('wrist_articulation_v2.txt');
    // "свежие" кватернионы: строки, где Q0–Q3 изменились
    let worst = 0, count = 0;
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i], b = rows[i - 1];
      if (a.q0 === b.q0 && a.q1 === b.q1 && a.q2 === b.q2 && a.q3 === b.q3) continue;
      const qx = 2 * (a.q1 * a.q3 + a.q0 * a.q2), qy = 2 * (a.q2 * a.q3 - a.q0 * a.q1);
      const d = Math.hypot(extras.tip.x[i] / 1.8 - qx, extras.tip.y[i] / 1.8 - qy);
      worst = Math.max(worst, d); count++;
    }
    expect(count).toBeGreaterThan(10);
    expect(worst).toBeLessThan(0.018); // факт: 0,0134
  });

  test('wrist v2: скорость рыскания без выбросов на ±180°', () => {
    const { rows, extras } = session('wrist_articulation_v2.txt');
    const v = buildVizData(rows, extras, rows.length); // без прореживания
    const maxRate = Math.max(...v.derived.rateZ.map(Math.abs));
    expect(maxRate).toBeLessThan(500); // факт: 117 °/с; скачок 360° дал бы ~18 000 °/с
  });

  test('Displacement mode: trajectory = null, остальное строится', () => {
    const { rows, extras } = session('wrist_articulation.txt');
    const v = buildVizData(rows, extras, 120);
    expect(v.trajectory).toBeNull();
    expect(v.derived.tipX.length).toBe(120);
  });
});
