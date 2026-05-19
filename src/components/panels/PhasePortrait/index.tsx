import { useMemo, useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { useData } from '../../DataContext/context';
import type { ImuVisualizationData } from '../../../types/imu';

const EMPTY_STATE = (
  <div style={{
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#aaa', fontSize: 13,
  }}>
    Загрузите TSV файл
  </div>
);

type Axis = 'X' | 'Y' | 'Z';

const AXIS_LABELS: Record<Axis, string> = {
  X: 'Крен (AngleX)',
  Y: 'Тангаж (AngleY)',
  Z: 'Рыскание (AngleZ)',
};

function lerpColor(f: number): string {
  const r = Math.round(29 + f * 54);
  const g = Math.round(158 - f * 84);
  const b = Math.round(117 + f * 66);
  return `rgb(${r},${g},${b})`;
}

function Chart({ vizData, axis }: { vizData: ImuVisualizationData; axis: Axis }) {
  const { recording } = vizData;

  const { points, xDomain, yDomain } = useMemo(() => {
    const angles = axis === 'X'
      ? recording.angleX
      : axis === 'Y'
        ? recording.angleY
        : recording.angleZ;
    const t = recording.t;
    const N = angles.length;

    const pts: { x: number; y: number; f: number }[] = [];
    for (let i = 1; i < N; i++) {
      const dt = t[i] - t[i - 1];
      if (dt <= 0) continue;
      const rate = (angles[i] - angles[i - 1]) / dt;
      if (!isFinite(rate)) continue;
      pts.push({
        x: Math.round(angles[i] * 10) / 10,
        y: Math.round(rate * 10) / 10,
        f: i / (N - 1),
      });
    }

    if (pts.length === 0) {
      return { points: [], xDomain: [-5, 5], yDomain: [-10, 10] };
    }

    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const xPad = 5;
    const yPad = 10;
    return {
      points: pts,
      xDomain: [Math.floor(Math.min(...xs)) - xPad, Math.ceil(Math.max(...xs)) + xPad],
      yDomain: [Math.floor(Math.min(...ys)) - yPad, Math.ceil(Math.max(...ys)) + yPad],
    };
  }, [vizData, axis]);

  const label = AXIS_LABELS[axis];

  return (
    <div style={{ flex: 1, minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
          <XAxis
            type="number"
            dataKey="x"
            name={label}
            domain={xDomain}
            tick={{ fontSize: 11 }}
            unit="°"
            label={{ value: `${label}, °`, position: 'insideBottom', offset: -2, fontSize: 11, fill: '#888' }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Скорость"
            domain={yDomain}
            tick={{ fontSize: 11 }}
            unit="°/с"
            width={52}
            label={{ value: '°/с', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#888' }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(v: unknown, name: unknown) => [
              `${v}${name === 'Скорость' ? ' °/с' : '°'}`,
              String(name),
            ]}
            labelFormatter={() => ''}
          />
          <ReferenceLine x={0} stroke="#eee" />
          <ReferenceLine y={0} stroke="#eee" />
          <Scatter data={points} isAnimationActive={false}>
            {points.map((p, i) => (
              <Cell key={i} fill={lerpColor(p.f)} fillOpacity={0.65} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function PhasePortrait() {
  const { vizData } = useData();
  const [axis, setAxis] = useState<Axis>('X');

  if (!vizData) return EMPTY_STATE;

  const btnStyle = (a: Axis): React.CSSProperties => ({
    padding: '1px 8px',
    fontSize: 11,
    border: '1px solid #d0d0d0',
    borderRadius: 4,
    background: axis === a ? '#534AB7' : '#fff',
    color: axis === a ? '#fff' : '#555',
    cursor: 'pointer',
    marginLeft: 4,
  });

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '6px 12px 2px',
        fontSize: 11,
        color: '#888',
        flexShrink: 0,
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
      }}>
        Фазовый портрет: угол vs скорость изменения
        <span style={{ flex: 1 }} />
        {(['X', 'Y', 'Z'] as Axis[]).map(a => (
          <button key={a} style={btnStyle(a)} onClick={() => setAxis(a)}>
            {AXIS_LABELS[a].split(' ')[0]}
          </button>
        ))}
      </div>
      <Chart vizData={vizData} axis={axis} />
    </div>
  );
}
