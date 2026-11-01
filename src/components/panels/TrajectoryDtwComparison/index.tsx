// components/panels/TrajectoryDtwComparison
//
// v5.1: hand trajectories of both recordings, top view (X–Y, mm from start),
// with DTW alignment links (dtwTraj, N-dim DTW on x, y, z).

import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import type { DtwComparisonData } from '../../../types/dtw';
import { ACCURACY_HINT } from '../../../utils/trajectoryViz';

interface Props {
  data: DtwComparisonData;
}

/** Max number of DTW links drawn between the trajectories */
const MAX_LINKS = 30;

export default function TrajectoryDtwComparison({ data }: Props) {
  const { rec1, rec2, dtwTraj } = data;

  const { pts1, pts2, links } = useMemo(() => {
    if (!rec1.traj || !rec2.traj || !dtwTraj) return { pts1: [], pts2: [], links: [] };
    const a = rec1.traj, b = rec2.traj;
    const pts1 = a.x.map((x, i) => ({ x, y: a.y[i] }));
    const pts2 = b.x.map((x, i) => ({ x, y: b.y[i] }));
    const step = Math.max(1, Math.floor(dtwTraj.path.length / MAX_LINKS));
    const links = dtwTraj.path
      .filter((_, k) => k % step === 0)
      .map(([i, j]) => [{ x: a.x[i], y: a.y[i] }, { x: b.x[j], y: b.y[j] }] as const);
    return { pts1, pts2, links };
  }, [rec1, rec2, dtwTraj]);

  if (!dtwTraj) {
    const missing = [rec1, rec2].filter(r => !r.traj).map(r => r.label).join(', ');
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#999', fontSize: 13, padding: 24, textAlign: 'center',
      }}>
        Сравнение траекторий недоступно: нет траектории у {missing} (Displacement mode или слишком короткая запись)
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        title={ACCURACY_HINT}
        style={{ padding: '6px 12px 2px', fontSize: 11, color: '#888', flexShrink: 0, borderBottom: '1px solid #f0f0f0' }}
      >
        DTW: <span style={{ color: '#534AB7', fontWeight: 600 }}>{dtwTraj.distance} мм</span>
        <span style={{ marginLeft: 8 }}>({dtwTraj.normalized} мм/шаг, путь {dtwTraj.path.length})</span>
        <span style={{ marginLeft: 8, color: '#aaa' }}>вид сверху, мм от старта</span>
        <span style={{ marginLeft: 6, color: '#bbb', cursor: 'help' }}>ⓘ</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <XAxis dataKey="x" type="number" name="X" unit=" мм" tick={{ fontSize: 11 }} />
            <YAxis dataKey="y" type="number" name="Y" unit=" мм" tick={{ fontSize: 11 }} width={60} />
            <Tooltip formatter={(v: unknown, name: unknown) => [`${v} мм`, String(name)]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {links.map(([p, q], k) => (
              <ReferenceLine key={k} segment={[p, q]} stroke="#999" strokeOpacity={0.35} strokeDasharray="2 2" />
            ))}
            <Scatter name={rec1.label} data={pts1} fill="#E24B4A" line={{ strokeWidth: 1.5 }} lineType="joint" shape={() => null} />
            <Scatter name={rec2.label} data={pts2} fill="#378ADD" line={{ strokeWidth: 1.5 }} lineType="joint" shape={() => null} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
