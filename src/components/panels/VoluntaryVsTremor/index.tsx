// components/panels/VoluntaryVsTremor/index.tsx
//
// v3_1: Shows CDF separation of voluntary motion and tremor
//
// Input: TremorAnalysis (from tremorPipeline.runTremorPipeline)
// Data used: t, raw, voluntary, tremor
// Processing: none (already done in pipeline)
// Rendering: two stacked Recharts LineCharts
//   Top: raw gyro (gray) + voluntary estimate (red)
//   Bottom: tremor only (blue) — zoomed scale

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import type { TremorAnalysis } from '../../../types/tremor';

interface Props {
  data: TremorAnalysis;
}

export default function VoluntaryVsTremor({ data }: Props) {
  const chartData = useMemo(() => {
    return data.t.map((time, i) => ({
      t: Math.round(time * 10) / 10,
      raw: Math.round(data.raw[i] * 10) / 10,
      vol: Math.round(data.voluntary[i] * 10) / 10,
      trm: Math.round(data.tremor[i] * 10) / 10,
    }));
  }, [data]);

  const formatTime = (v: number) => `${v}s`;
  const formatDeg = (v: number) => `${v}°/s`;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top chart: raw + voluntary */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <XAxis
              dataKey="t"
              tickFormatter={formatTime}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatDeg}
              tick={{ fontSize: 11 }}
              width={55}
            />
            <Tooltip
              formatter={(v, name) => [
                `${v} °/s`,
                name === 'raw' ? 'Сырой гироскоп' : 'Произвольное (CDF)',
              ]}
              labelFormatter={(l) => `${l} с`}
            />
            <Legend
              formatter={(value) =>
                value === 'raw' ? 'Сырой гироскоп' : 'Произвольное (CDF θ=0.990)'
              }
              wrapperStyle={{ fontSize: 11 }}
            />
            <ReferenceLine y={0} stroke="#ddd" />
            <Line
              dataKey="raw"
              stroke="rgba(60,60,60,0.35)"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="vol"
              stroke="#E24B4A"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom chart: tremor only */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
            <XAxis
              dataKey="t"
              tickFormatter={formatTime}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatDeg}
              tick={{ fontSize: 11 }}
              width={55}
            />
            <Tooltip
              formatter={(v) => [`${v} °/s`, 'Тремор']}
              labelFormatter={(l) => `${l} с`}
            />
            <Legend
              formatter={() => 'Тремор (raw − voluntary)'}
              wrapperStyle={{ fontSize: 11 }}
            />
            <ReferenceLine y={0} stroke="#ddd" />
            <Line
              dataKey="trm"
              stroke="#378ADD"
              strokeWidth={1.2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
