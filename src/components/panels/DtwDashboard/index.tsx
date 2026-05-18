// components/panels/DtwDashboard
//
// Main dashboard: load two TSV files → run DTW pipeline → show 7 panels.

import React, { useState, useCallback } from 'react';
import { runDtwPipeline } from '../../../utils/dtwPipeline';
import type { DtwComparisonData } from '../../../types/dtw';

import RollComparison from '../RollComparison';
import TrajectoryComparison from '../TrajectoryComparison';
import DtwAlignmentMatrix from '../DtwAlignmentMatrix';
import TipComparison from '../TipComparison';
import TipTrailDtw3D from '../TipTrailDtw3D';
import RollRibbonsDtw3D from '../RollRibbonsDtw3D';
import OrientationDtw3D from '../OrientationDtw3D';

export default function DtwDashboard() {
  const [comparison, setComparison] = useState<DtwComparisonData | null>(null);
  const [file1, setFile1] = useState<string | null>(null);
  const [name1, setName1] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFile1 = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setName1(f.name);
    setFile1(await f.text());
    setComparison(null);
  }, []);

  const handleFile2 = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !file1) return;
    setLoading(true);
    try {
      const text2 = await f.text();
      const result = runDtwPipeline(file1, text2, name1, f.name);
      setComparison(result);
    } catch (err) {
      console.error('DTW pipeline error:', err);
    } finally {
      setLoading(false);
    }
  }, [file1, name1]);

  const panelStyle: React.CSSProperties = {
    border: '1px solid #eee',
    borderRadius: 8,
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    padding: '6px 12px',
    borderBottom: '1px solid #eee',
    fontSize: 13,
    fontWeight: 500,
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16, fontFamily: 'system-ui' }}>
      <h2 style={{ fontSize: 18, fontWeight: 500, margin: '0 0 12px' }}>
        Сравнение траекторий (DTW)
      </h2>

      {/* File inputs */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 13, color: '#666' }}>Запись 1: </label>
          <input type="file" accept=".txt,.tsv" onChange={handleFile1} />
        </div>
        <div>
          <label style={{ fontSize: 13, color: '#666' }}>Запись 2: </label>
          <input type="file" accept=".txt,.tsv" onChange={handleFile2} disabled={!file1} />
        </div>
        {loading && <span style={{ fontSize: 13, color: '#888' }}>Вычисление DTW...</span>}
      </div>

      {!file1 && (
        <div style={{ padding: '32px 0', color: '#aaa', fontSize: 14 }}>
          Загрузите два TSV-файла для сравнения траекторий
        </div>
      )}

      {file1 && !comparison && !loading && (
        <div style={{ padding: '16px 0', color: '#aaa', fontSize: 14 }}>
          Теперь загрузите Запись 2
        </div>
      )}

      {comparison && (
        <>
          {/* Metrics bar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'DTW (Euler)', value: `${comparison.dtwEuler.distance}°` },
              { label: 'Норм. DTW', value: `${comparison.dtwEuler.normalized} °/шаг` },
              { label: 'DTW (Tip)', value: `${comparison.dtwTip.distance}` },
              { label: 'Путь DTW', value: `${comparison.dtwEuler.path.length} шагов` },
              { label: comparison.rec1.label, value: `${comparison.rec1.duration.toFixed(1)} с` },
              { label: comparison.rec2.label, value: `${comparison.rec2.duration.toFixed(1)} с` },
            ].map((m, i) => (
              <div key={i} style={{
                background: '#f5f5f0', borderRadius: 6, padding: '6px 12px', fontSize: 12,
              }}>
                {m.label}
                <div style={{ fontWeight: 600, fontSize: 15, marginTop: 2 }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* 2D panels: 2×2 grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ ...panelStyle, height: 340 }}>
              <div style={headerStyle}>v4.1 Roll во времени</div>
              <div style={{ height: 'calc(100% - 33px)' }}>
                <RollComparison data={comparison} />
              </div>
            </div>

            <div style={{ ...panelStyle, height: 340 }}>
              <div style={headerStyle}>v4.2 Траектории Roll vs Pitch</div>
              <div style={{ height: 'calc(100% - 33px)' }}>
                <TrajectoryComparison data={comparison} />
              </div>
            </div>

            <div style={{ ...panelStyle, height: 340 }}>
              <div style={headerStyle}>v4.3 DTW-матрица выравнивания</div>
              <div style={{ height: 'calc(100% - 33px)', display: 'flex', justifyContent: 'center', padding: 8 }}>
                <DtwAlignmentMatrix data={comparison} width={300} height={300} />
              </div>
            </div>

            <div style={{ ...panelStyle, height: 340 }}>
              <div style={headerStyle}>v4.4 Tip-траектории (tipX vs tipY)</div>
              <div style={{ height: 'calc(100% - 33px)' }}>
                <TipComparison data={comparison} />
              </div>
            </div>
          </div>

          {/* 3D panels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={panelStyle}>
              <div style={headerStyle}>v4.5 3D-следы кончиков + DTW</div>
              <TipTrailDtw3D data={comparison} />
            </div>

            <div style={panelStyle}>
              <div style={headerStyle}>v4.6 3D-ленты Roll + DTW</div>
              <RollRibbonsDtw3D data={comparison} />
            </div>
          </div>

          <div style={panelStyle}>
            <div style={headerStyle}>v4.7 3D Roll × Pitch × Время + DTW</div>
            <OrientationDtw3D data={comparison} />
          </div>
        </>
      )}
    </div>
  );
}
