// components/panels/RollComparison
//
// v4_1: Roll (AngleX) of both recordings on the same time axis.

import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { DtwComparisonData } from '../../../types/dtw';

interface Props {
  data: DtwComparisonData;
}

export default function RollComparison({ data }: Props) {
  const { rec1, rec2 } = data;

  const pts1 = useMemo(() => rec1.t.map((t, i) => ({ x: t, y: rec1.roll[i] })), [rec1]);
  const pts2 = useMemo(() => rec2.t.map((t, i) => ({ x: t, y: rec2.roll[i] })), [rec2]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
        <XAxis
          dataKey="x" type="number" name="Время"
          unit="с" tick={{ fontSize: 11 }}
          domain={[0, Math.max(rec1.duration, rec2.duration) || 1]}
        />
        <YAxis
          dataKey="y" type="number" name="Roll"
          unit="°" tick={{ fontSize: 11 }} width={50}
        />
        <Tooltip
          formatter={(v: unknown) => [`${v}°`]}
          labelFormatter={(l) => `${l} с`}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Scatter name={rec1.label} data={pts1} fill="#E24B4A" line={{ strokeWidth: 1.5 }} lineType="joint" shape={() => null} />
        <Scatter name={rec2.label} data={pts2} fill="#378ADD" line={{ strokeWidth: 1.5 }} lineType="joint" shape={() => null} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
