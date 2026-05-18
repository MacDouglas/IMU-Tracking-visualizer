// @ts-ignore — fft.js has no bundled TypeScript types
import FFT from 'fft.js';
import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { useData } from '../../DataContext/context';
import type { SensorRow } from '../../../utils/tsvParser';

const EMPTY_STATE = (
  <div style={{
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#aaa', fontSize: 13,
  }}>
    Загрузите TSV файл
  </div>
);

const WIN_SIZE = 256;
const HOP = 128;
const MAX_HZ = 20;

function hann(i: number, N: number): number {
  return 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
}

function computePSD(rows: SensorRow[]): { freq: number; psd: number }[] {
  if (rows.length < WIN_SIZE) return [];

  const N = rows.length;
  const fs = N / (rows[N - 1].time - rows[0].time || 1);
  const freqRes = fs / WIN_SIZE;
  const maxBin = Math.min(Math.floor(MAX_HZ / freqRes), WIN_SIZE / 2);

  const fft = new FFT(WIN_SIZE);
  const complexOut = fft.createComplexArray();
  const hannSum = Array.from({ length: WIN_SIZE }, (_, i) => hann(i, WIN_SIZE)).reduce((a, b) => a + b * b, 0);
  const scale = hannSum * WIN_SIZE;

  const accumPower = new Float64Array(maxBin + 1);
  let numWindows = 0;

  for (let start = 0; start + WIN_SIZE <= N; start += HOP) {
    const realIn = new Array<number>(WIN_SIZE);
    for (let j = 0; j < WIN_SIZE; j++) {
      realIn[j] = rows[start + j].asX * hann(j, WIN_SIZE);
    }
    fft.realTransform(complexOut, realIn);
    for (let fi = 0; fi <= maxBin; fi++) {
      const re = complexOut[2 * fi];
      const im = complexOut[2 * fi + 1];
      accumPower[fi] += (re * re + im * im) / scale;
    }
    numWindows++;
  }

  if (numWindows === 0) return [];

  const result: { freq: number; psd: number }[] = [];
  for (let fi = 0; fi <= maxBin; fi++) {
    const avg = accumPower[fi] / numWindows;
    const db = Math.round(10 * Math.log10(avg + 1e-10) * 10) / 10;
    result.push({ freq: Math.round(fi * freqRes * 10) / 10, psd: db });
  }
  return result;
}

function Chart({ rows }: { rows: SensorRow[] }) {
  const data = useMemo(() => computePSD(rows), [rows]);

  if (data.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 13 }}>
        Недостаточно данных
      </div>
    );
  }

  const peakPt = data.reduce((a, b) => (b.psd > a.psd ? b : a), data[0]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '6px 12px 2px',
        fontSize: 11,
        color: '#888',
        flexShrink: 0,
        borderBottom: '1px solid #f0f0f0',
      }}>
        Спектр тремора (AsX, Welch 256pts)
        <span style={{ marginLeft: 12 }}>
          Пик: <span style={{ color: '#534AB7', fontWeight: 600 }}>{peakPt.freq} Гц</span>
          <span style={{ color: '#aaa', marginLeft: 8 }}>Физиол. тремор 8–12 Гц</span>
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <XAxis
              dataKey="freq"
              tickFormatter={(v) => `${v}`}
              tick={{ fontSize: 11 }}
              unit=" Гц"
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => `${v}`}
              tick={{ fontSize: 11 }}
              width={48}
              unit=" дБ"
            />
            <Tooltip
              formatter={(v: unknown) => [`${v} дБ`, 'Мощность']}
              labelFormatter={(l) => `${l} Гц`}
            />
            {/* Physiological tremor band 8–12 Hz */}
            <ReferenceArea x1={8} x2={12} fill="#534AB7" fillOpacity={0.06} />
            <ReferenceLine x={8} stroke="#534AB7" strokeDasharray="4 3" strokeOpacity={0.4} />
            <ReferenceLine x={12} stroke="#534AB7" strokeDasharray="4 3" strokeOpacity={0.4} />
            <ReferenceLine x={peakPt.freq} stroke="#D85A30" strokeDasharray="4 3" strokeOpacity={0.6} />
            <Line
              dataKey="psd"
              stroke="#534AB7"
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

export default function TremorSpectrum() {
  const { rows } = useData();
  if (rows.length === 0) return EMPTY_STATE;
  return <Chart rows={rows} />;
}
