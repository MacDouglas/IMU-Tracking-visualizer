// components/panels/TipComparison
//
// v4_4: tipX vs tipY scatter for both recordings.

import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { DtwComparisonData } from '../../../types/dtw';

interface Props {
  data: DtwComparisonData;
}

export default function TipComparison({ data }: Props) {
  const { rec1, rec2 } = data;

  const pts1 = useMemo(() => rec1.tipX.map((x, i) => ({ x, y: rec1.tipY[i] })), [rec1]);
  const pts2 = useMemo(() => rec2.tipX.map((x, i) => ({ x, y: rec2.tipY[i] })), [rec2]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
        <XAxis
          dataKey="x" type="number" name="tipX"
          tick={{ fontSize: 11 }} domain={[-2, 2]}
          label={{ value: 'tipX', position: 'bottom', fontSize: 11, offset: -2 }}
        />
        <YAxis
          dataKey="y" type="number" name="tipY"
          tick={{ fontSize: 11 }} width={45} domain={[-2, 2]}
          label={{ value: 'tipY', angle: -90, position: 'insideLeft', fontSize: 11 }}
        />
        <Tooltip formatter={(v: unknown) => [Number(v).toFixed(3)]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Scatter name={rec1.label + ' (tip)'} data={pts1} fill="rgba(226,75,74,0.35)" />
        <Scatter name={rec2.label + ' (tip)'} data={pts2} fill="rgba(55,138,221,0.35)" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
