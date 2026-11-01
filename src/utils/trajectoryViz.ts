// utils/trajectoryViz.ts — helpers for the trajectory panels (Trajectory3D, TrajectoryTimeline)

import type { VizTrajectory } from '../types/imu';

export type TrajectoryMode = 'total' | 'base' | 'rot';

export const TRAJECTORY_MODES: { id: TrajectoryMode; label: string; hint: string }[] = [
  { id: 'total', label: 'Итог', hint: 'перенос + поворот' },
  { id: 'base', label: 'Перенос', hint: 'движение центра вращения' },
  { id: 'rot', label: 'Поворот', hint: 'датчик вокруг центра вращения' },
];

/** v5.1 §4: shown next to every trajectory panel */
export const ACCURACY_HINT =
  'Точность проверена на квадрате 200 мм (≈ 271 × 216 мм, возврат 43 мм). ' +
  'При движении без пауз дольше 1–2 с ошибка растёт.';

/** Arrays [x, y, z] in mm for a mode */
export function modeArrays(tr: VizTrajectory, mode: TrajectoryMode): [number[], number[], number[]] {
  if (mode === 'base') return [tr.baseX, tr.baseY, tr.baseZ];
  if (mode === 'rot') return [tr.rotX, tr.rotY, tr.rotZ];
  return [tr.trajX, tr.trajY, tr.trajZ];
}

/** Smallest 1/2/5·10^k that is ≥ x */
export function niceStep(x: number): number {
  if (!(x > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  for (const m of [1, 2, 5]) if (m * p >= x) return m * p;
  return 10 * p;
}

/** [start, end) index runs where flags[i] === 1 */
export function runs(flags: ArrayLike<number>): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < flags.length;) {
    if (flags[i] !== 1) { i++; continue; }
    const b = i;
    while (i < flags.length && flags[i] === 1) i++;
    out.push([b, i]);
  }
  return out;
}
