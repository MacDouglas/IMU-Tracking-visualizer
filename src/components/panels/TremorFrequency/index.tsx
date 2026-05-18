// components/panels/TremorFrequency/index.tsx
//
// v3_3: Instantaneous tremor frequency over time
//
// Input: TremorAnalysis
// Data used: t, frequency (WFLC adaptive estimate)
// Processing: none (WFLC done in pipeline)
// Rendering: Recharts LineChart with colored reference bands
//
// Reference bands (from literature):
//   0–2 Hz:   Voluntary movement zone (gray)
//   3–7 Hz:   Pathological tremor (Parkinson, cerebellar)
//   8–12 Hz:  Physiological tremor (normal hand tremor)
//
// If frequency stays at lower clamp (2 Hz), it means
// WFLC cannot find a sinusoidal component — the signal
// is dominated by non-periodic motion, not classic tremor.

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine,
} from 'recharts';
import type { TremorAnalysis } from '../../../types/tremor';

interface Props {
  data: TremorAnalysis;
}

export default function TremorFrequency({ data }: Props) {
  const chartData = useMemo(() => {
    return data.t.map((time, i) => ({
      t: Math.round(time * 10) / 10,
      frq: Math.round(data.frequency[i] * 10) / 10,
    }));
  }, [data]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '4px 8px', fontSize: 12, color: '#888' }}>
        WFLC адаптивная оценка &nbsp;|&nbsp; f₀ = 8 Hz &nbsp;|&nbsp; Clamp: 2–20 Hz
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            {/* Reference bands */}
            <ReferenceArea
              y1={0} y2={2}
              fill="rgba(150,150,150,0.06)"
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              y1={3} y2={7}
              fill="rgba(216,90,48,0.06)"
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              y1={8} y2={12}
              fill="rgba(55,138,221,0.06)"
              ifOverflow="extendDomain"
            />

            <XAxis
              dataKey="t"
              tickFormatter={(v) => `${v}s`}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 14]}
              tickFormatter={(v) => `${v}`}
              tick={{ fontSize: 11 }}
              width={35}
              label={{
                value: 'Hz',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 11, fill: '#888' },
              }}
            />
            <Tooltip
              formatter={(v) => [`${v} Hz`, 'Частота тремора']}
              labelFormatter={(l) => `${l} с`}
            />

            {/* Labeled reference lines */}
            <ReferenceLine y={2} stroke="#aaa" strokeDasharray="4 4" />
            <ReferenceLine y={8} stroke="#378ADD" strokeDasharray="4 4" />
            <ReferenceLine y={12} stroke="#378ADD" strokeDasharray="4 4" />

            <Line
              dataKey="frq"
              stroke="#534AB7"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend for frequency bands */}
      <div style={{
        display: 'flex', gap: 12, padding: '4px 8px',
        fontSize: 11, color: '#888',
      }}>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(150,150,150,0.15)', marginRight: 4, verticalAlign: 'middle' }} />
          0–2 Hz Произвольное
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(216,90,48,0.15)', marginRight: 4, verticalAlign: 'middle' }} />
          3–7 Hz Патологический
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(55,138,221,0.15)', marginRight: 4, verticalAlign: 'middle' }} />
          8–12 Hz Физиологический
        </span>
      </div>
    </div>
  );
}
