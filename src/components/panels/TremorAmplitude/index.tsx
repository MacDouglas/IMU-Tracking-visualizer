// components/panels/TremorAmplitude/index.tsx
//
// v3_2: Instantaneous tremor amplitude over time
//
// Input: TremorAnalysis
// Data used: t, amplitude (Kalman-smoothed)
// Processing: none (Kalman filter done in pipeline)
// Rendering: Recharts AreaChart — orange line with light fill
//
// Interpretation:
//   - Baseline (rest): amplitude ≈ 0 °/s
//   - During movement: amplitude shows tremor severity
//   - Compare start vs end of recording → fatigue detection

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { TremorAnalysis } from '../../../types/tremor';

interface Props {
  data: TremorAnalysis;
}

export default function TremorAmplitude({ data }: Props) {
  const chartData = useMemo(() => {
    return data.t.map((time, i) => ({
      t: Math.round(time * 10) / 10,
      amp: Math.round(data.amplitude[i] * 100) / 100,
    }));
  }, [data]);

  const peakAmp = useMemo(
    () => Math.max(...data.amplitude).toFixed(1),
    [data]
  );

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '4px 8px', fontSize: 12, color: '#888' }}>
        WFLC → Kalman Filter &nbsp;|&nbsp; Пик: {peakAmp} °/с
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="ampGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D85A30" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#D85A30" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="t"
              tickFormatter={(v) => `${v}s`}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => `${v}`}
              tick={{ fontSize: 11 }}
              width={45}
              label={{
                value: '°/s',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 11, fill: '#888' },
              }}
            />
            <Tooltip
              formatter={(v) => [`${v} °/s`, 'Амплитуда тремора']}
              labelFormatter={(l) => `${l} с`}
            />
            <ReferenceLine y={0} stroke="#eee" />
            <Area
              dataKey="amp"
              stroke="#D85A30"
              strokeWidth={2}
              fill="url(#ampGrad)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
