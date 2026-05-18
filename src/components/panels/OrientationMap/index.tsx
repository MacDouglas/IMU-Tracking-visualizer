import { useMemo } from 'react';
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

function lerpColor(f: number): string {
  const r = Math.round(29 + f * 54);
  const g = Math.round(158 - f * 84);
  const b = Math.round(117 + f * 66);
  return `rgb(${r},${g},${b})`;
}

function Chart({ vizData }: { vizData: ImuVisualizationData }) {
  const { recording } = vizData;

  const { points, xMin, xMax, yMin, yMax } = useMemo(() => {
    const N = recording.angleX.length;
    const pts = recording.angleX.map((x, i) => ({
      x: Math.round(x * 10) / 10,
      y: Math.round(recording.angleY[i] * 10) / 10,
      f: i / (N - 1),
    }));
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    return {
      points: pts,
      xMin: Math.floor(Math.min(...xs)),
      xMax: Math.ceil(Math.max(...xs)),
      yMin: Math.floor(Math.min(...ys)),
      yMax: Math.ceil(Math.max(...ys)),
    };
  }, [recording]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '6px 12px 2px',
        fontSize: 11,
        color: '#888',
        flexShrink: 0,
        borderBottom: '1px solid #f0f0f0',
      }}>
        Карта ориентации: Крен vs Тангаж
        <span style={{ marginLeft: 12, color: '#aaa' }}>цвет — время (зелёный→фиолетовый)</span>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <XAxis
              type="number"
              dataKey="x"
              name="Крен"
              domain={[xMin, xMax]}
              tick={{ fontSize: 11 }}
              unit="°"
              label={{ value: 'Крен (AngleX), °', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#888' }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Тангаж"
              domain={[yMin, yMax]}
              tick={{ fontSize: 11 }}
              unit="°"
              width={48}
              label={{ value: 'Тангаж (AngleY), °', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#888' }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(v: unknown, name: unknown) => [`${v}°`, String(name)]}
              labelFormatter={() => ''}
            />
            <ReferenceLine x={0} stroke="#eee" />
            <ReferenceLine y={0} stroke="#eee" />
            <Scatter data={points} isAnimationActive={false}>
              {points.map((p, i) => (
                <Cell key={i} fill={lerpColor(p.f)} fillOpacity={0.7} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function OrientationMap() {
  const { vizData } = useData();
  if (!vizData) return EMPTY_STATE;
  return <Chart vizData={vizData} />;
}
