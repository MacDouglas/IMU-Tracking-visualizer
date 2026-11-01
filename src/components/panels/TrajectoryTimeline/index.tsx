// components/panels/TrajectoryTimeline/index.tsx
//
// v5.1: траектория во времени
//
// Input data: vizData.trajectory (sampled at vizData.indices), recording.t
// Processing:
//   - ‖p‖ = √(trajX² + trajY² + trajZ²) — distance from start, mm
//   - ‖rot‖ = √(rotX² + rotY² + rotZ²) — rotation (lever arm) contribution, mm
//   - runs of still = 1 → shaded bands (ZUPT zeroed the velocity there)
// Rendering: two lines on one mm axis, grey bands for rest, vertical line at currentIndex

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ReferenceArea, ReferenceLine,
} from 'recharts';
import type { ImuVisualizationData } from '../../../types/imu';
import { ACCURACY_HINT, runs } from '../../../utils/trajectoryViz';

const EMPTY_STYLE: React.CSSProperties = {
  width: '100%', height: '100%', display: 'flex', alignItems: 'center',
  justifyContent: 'center', color: '#aaa', fontSize: 13, padding: 24, textAlign: 'center',
};

const LABELS: Record<string, string> = {
  dist: '‖итог‖ — расстояние от старта',
  rot: '‖поворот‖ — вклад вращения',
};

interface TrajectoryTimelineProps {
  data?: ImuVisualizationData | null;
  currentIndex: number;
}

export default function TrajectoryTimeline({ data, currentIndex }: TrajectoryTimelineProps) {
  const tr = data?.trajectory ?? null;
  const t = data?.recording.t;

  const { chartData, bands, peak, ret } = useMemo(() => {
    if (!tr || !t) return { chartData: [], bands: [], peak: 0, ret: 0 };
    const r1 = (v: number) => Math.round(v * 10) / 10;
    const chartData = t.map((time, i) => ({
      t: r1(time),
      dist: r1(Math.hypot(tr.trajX[i], tr.trajY[i], tr.trajZ[i])),
      rot: r1(Math.hypot(tr.rotX[i], tr.rotY[i], tr.rotZ[i])),
    }));
    const last = t.length - 1;
    const bands = runs(tr.still).map(([b, e]) => [t[b], t[Math.min(e, last)]] as const);
    const peak = Math.max(...chartData.map(d => d.dist));
    return { chartData, bands, peak, ret: chartData[last].dist };
  }, [tr, t]);

  if (!data) return <div style={EMPTY_STYLE}>Загрузите TSV файл</div>;
  if (!tr) return <div style={EMPTY_STYLE}>Траектория не рассчитана: запись слишком короткая</div>;

  const curT = data.recording.t[Math.min(currentIndex, data.recording.t.length - 1)];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        title={ACCURACY_HINT}
        style={{ padding: '6px 12px 2px', fontSize: 11, color: '#888', flexShrink: 0, borderBottom: '1px solid #f0f0f0' }}
      >
        Макс. удаление: <span style={{ color: '#534AB7', fontWeight: 600 }}>{peak.toFixed(0)} мм</span>
        <span style={{ marginLeft: 12 }}>
          Возврат в конце: <span style={{ color: '#534AB7', fontWeight: 600 }}>{ret.toFixed(0)} мм</span>
        </span>
        <span style={{ marginLeft: 6, color: '#bbb', cursor: 'help' }}>ⓘ</span>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v) => `${v}s`}
              tick={{ fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} width={52} unit=" мм" />
            <Tooltip
              formatter={(v: unknown, name: unknown) => [`${v} мм`, LABELS[String(name)] ?? String(name)]}
              labelFormatter={(l) => `${l} с`}
            />
            <Legend formatter={(value) => LABELS[value] ?? value} wrapperStyle={{ fontSize: 11 }} />
            {bands.map(([x1, x2], i) => (
              <ReferenceArea key={i} x1={x1} x2={x2} fill="#9a9a9a" fillOpacity={0.12} strokeOpacity={0} />
            ))}
            <ReferenceLine x={curT} stroke="#1D9E75" strokeDasharray="4 3" />
            <Line dataKey="dist" stroke="#534AB7" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line dataKey="rot" stroke="#D85A30" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ padding: '2px 12px 6px', fontSize: 10, color: '#aaa', flexShrink: 0 }}>
        <span style={{ color: '#9a9a9a' }}>■</span> покой (скорость обнулена) · мм, относительно старта
      </div>
    </div>
  );
}
