// components/panels/TrajectoryComparison
//
// v4_2: Roll vs Pitch scatter for both recordings overlaid.

import { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { DtwComparisonData } from '../../../types/dtw';

interface Props {
  data: DtwComparisonData;
}

export default function TrajectoryComparison({ data }: Props) {
  const { rec1, rec2 } = data;

  const pts1 = useMemo(() => rec1.roll.map((r, i) => ({ x: r, y: rec1.pitch[i] })), [rec1]);
  const pts2 = useMemo(() => rec2.roll.map((r, i) => ({ x: r, y: rec2.pitch[i] })), [rec2]);

  const allRoll = [...rec1.roll, ...rec2.roll];
  const allPitch = [...rec1.pitch, ...rec2.pitch];
  if (allRoll.length === 0) return null;
  const rMin = Math.min(...allRoll) - 10;
  const rMax = Math.max(...allRoll) + 10;
  const pMin = Math.min(...allPitch) - 10;
  const pMax = Math.max(...allPitch) + 10;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
        <XAxis
          dataKey="x" type="number" name="Roll"
          unit="°" tick={{ fontSize: 11 }} domain={[rMin, rMax]}
          label={{ value: 'Roll (°)', position: 'bottom', fontSize: 11, offset: -2 }}
        />
        <YAxis
          dataKey="y" type="number" name="Pitch"
          unit="°" tick={{ fontSize: 11 }} width={50} domain={[pMin, pMax]}
          label={{ value: 'Pitch (°)', angle: -90, position: 'insideLeft', fontSize: 11 }}
        />
        <Tooltip formatter={(v: unknown) => [`${v}°`]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Scatter name={rec1.label} data={pts1} fill="rgba(226,75,74,0.4)" />
        <Scatter name={rec2.label} data={pts2} fill="rgba(55,138,221,0.4)" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
