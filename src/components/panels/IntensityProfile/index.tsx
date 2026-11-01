import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
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

type AccSource = 'raw' | 'motion';

const ACC_LEGEND: Record<AccSource, string> = {
  raw: 'Ускорение √(Ax²+Ay²) ×100, г',
  motion: 'Ускорение движения (без g, оси комнаты) ×100, г',
};

function Chart({ vizData }: { vizData: ImuVisualizationData }) {
  // raw: sensor axes, contains gravity once the hand tilts; motion: v5.1 accMotionHorizG
  const [accSource, setAccSource] = useState<AccSource>('raw');
  const motionAvailable = vizData.derived.accMotionHoriz !== null;
  const source: AccSource = motionAvailable ? accSource : 'raw';

  const chartData = useMemo(() => {
    const { t } = vizData.recording;
    const { gyroMag } = vizData.derived;
    const acc = (source === 'motion' ? vizData.derived.accMotionHoriz : null) ?? vizData.derived.accHoriz;
    return t.map((time, i) => ({
      t: Math.round(time * 10) / 10,
      gyro: Math.round(gyroMag[i] * 10) / 10,
      // ×100 to bring g-units into visual parity with °/s on shared axis
      acc: Math.round(acc[i] * 100 * 10) / 10,
    }));
  }, [vizData, source]);

  const btnStyle = (s: AccSource): React.CSSProperties => ({
    padding: '1px 8px',
    fontSize: 11,
    border: '1px solid #d0d0d0',
    borderRadius: 4,
    background: source === s ? '#534AB7' : '#fff',
    color: source === s ? '#fff' : '#555',
    cursor: 'pointer',
    marginLeft: 4,
  });

  const peakGyro = useMemo(
    () => Math.max(...vizData.derived.gyroMag).toFixed(1),
    [vizData]
  );

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Заголовок с пиковым значением */}
      <div style={{
        padding: '6px 12px 2px',
        fontSize: 11,
        color: '#888',
        flexShrink: 0,
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
      }}>
        Пик гироскопа: <span style={{ color: '#534AB7', fontWeight: 600, marginLeft: 4 }}>{peakGyro} °/с</span>
        <span style={{ marginLeft: 12, color: '#aaa' }}>ускорение ×100</span>
        <span style={{ flex: 1 }} />
        {motionAvailable && (
          <>
            <button style={btnStyle('raw')} title="Оси датчика; при наклоне кисти содержит гравитацию" onClick={() => setAccSource('raw')}>
              Сырое
            </button>
            <button style={btnStyle('motion')} title="Оси комнаты, гравитация и смещение вычтены" onClick={() => setAccSource('motion')}>
              Без g
            </button>
          </>
        )}
      </div>

      {/* График */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <XAxis
              dataKey="t"
              tickFormatter={(v) => `${v}s`}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => `${v}`}
              tick={{ fontSize: 11 }}
              width={48}
              unit=" °/s"
            />
            <Tooltip
              formatter={(v: unknown, name: unknown) => [
                `${v}${name === 'gyro' ? ' °/с' : ' г×100'}`,
                name === 'gyro' ? 'Гироскоп' : source === 'motion' ? 'Ускорение движения' : 'Горизонт. ускорение',
              ]}
              labelFormatter={(l) => `${l} с`}
            />
            <Legend
              formatter={(value) =>
                value === 'gyro'
                  ? 'Гироскоп √(Gx²+Gy²+Gz²), °/с'
                  : ACC_LEGEND[source]
              }
              wrapperStyle={{ fontSize: 11 }}
            />
            <ReferenceLine y={0} stroke="#eee" />
            <Line
              dataKey="gyro"
              stroke="#534AB7"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="acc"
              stroke="#D85A30"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function IntensityProfile() {
  const { vizData } = useData();
  if (!vizData) return EMPTY_STATE;
  return <Chart vizData={vizData} />;
}
