import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { useData } from '../../DataContext/context';
import type { SensorRow } from '../../../utils/tsvParser';
import { DT, motionSpan } from '../../../utils/imuProcessing';
import { welchPsd, WELCH_WIN } from '../../../utils/spectrum';

const EMPTY_STATE = (
  <div style={{
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#aaa', fontSize: 13,
  }}>
    Загрузите TSV файл
  </div>
);

type Span = 'all' | 'motion';

const MESSAGE_STYLE: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#aaa', fontSize: 13, padding: 24, textAlign: 'center',
};

function Chart({ rows, stationary }: { rows: SensorRow[]; stationary: Uint8Array | null }) {
  // v5.1 §1 №7: default — whole recording; "motion only" = first..last non-stationary sample
  const [span, setSpan] = useState<Span>('all');
  const motion = useMemo(() => (stationary ? motionSpan(stationary) : null), [stationary]);
  const active: Span = motion ? span : 'all';

  const data = useMemo(() => {
    const [a, b] = active === 'motion' && motion ? motion : [0, rows.length];
    return welchPsd(rows.slice(a, b).map(r => r.asX));
  }, [rows, active, motion]);

  const btnStyle = (s: Span): React.CSSProperties => ({
    padding: '1px 8px',
    fontSize: 11,
    border: '1px solid #d0d0d0',
    borderRadius: 4,
    background: active === s ? '#534AB7' : '#fff',
    color: active === s ? '#fff' : '#555',
    cursor: 'pointer',
    marginLeft: 4,
  });

  const peakPt = data.length ? data.reduce((a, b) => (b.psd > a.psd ? b : a), data[0]) : null;
  const motionLabel = motion ? `${(motion[0] * DT).toFixed(1)}–${(motion[1] * DT).toFixed(1)} с` : '';

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
        AsX, Welch {WELCH_WIN}
        {peakPt && (
          <span style={{ marginLeft: 10 }}>
            Пик: <span style={{ color: '#534AB7', fontWeight: 600 }}>{peakPt.freq} Гц</span>
            <span style={{ color: '#aaa', marginLeft: 8 }}>тремор 8–12 Гц</span>
          </span>
        )}
        <span style={{ flex: 1 }} />
        {motion && (
          <>
            <button style={btnStyle('all')} onClick={() => setSpan('all')}>Вся запись</button>
            <button style={btnStyle('motion')} title={`Без покоя в начале и в конце: ${motionLabel}`} onClick={() => setSpan('motion')}>
              Только движение
            </button>
          </>
        )}
      </div>

      {!peakPt ? (
        <div style={MESSAGE_STYLE}>
          Недостаточно данных: нужно не меньше {WELCH_WIN} отсчётов ({(WELCH_WIN * DT).toFixed(2)} с)
        </div>
      ) : (
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
      )}
    </div>
  );
}

export default function TremorSpectrum() {
  const { rows, extras } = useData();
  if (rows.length === 0) return EMPTY_STATE;
  return <Chart rows={rows} stationary={extras?.trajectory?.stationary ?? null} />;
}
