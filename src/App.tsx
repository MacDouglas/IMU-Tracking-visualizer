import { useState, useCallback } from 'react';
import { DataProvider } from './components/DataContext';
import { useData } from './components/DataContext/context';
import type { AppTab } from './components/DataContext/context';
import FileUploader from './components/FileUploader';
import VirtualCanvas from './components/layout/VirtualCanvas';
import AngleTimeline from './components/panels/AngleTimeline';
import IntensityProfile from './components/panels/IntensityProfile';
import OrientationMap from './components/panels/OrientationMap';
import PhasePortrait from './components/panels/PhasePortrait';
import TremorSpectrum from './components/panels/TremorSpectrum';
import AngleRibbon3D from './components/panels/AngleRibbon3D';
import TipTrailTimeline3D from './components/panels/TipTrailTimeline3D';
import VoluntaryVsTremor from './components/panels/VoluntaryVsTremor';
import TremorAmplitude from './components/panels/TremorAmplitude';
import TremorFrequency from './components/panels/TremorFrequency';
import TremorSpectrogram from './components/panels/TremorSpectrogram';
import PlaybackControls from './components/shared/PlaybackControls';
import RollComparison from './components/panels/RollComparison';
import TrajectoryComparison from './components/panels/TrajectoryComparison';
import DtwAlignmentMatrix from './components/panels/DtwAlignmentMatrix';
import TipComparison from './components/panels/TipComparison';
import TipTrailDtw3D from './components/panels/TipTrailDtw3D';
import RollRibbonsDtw3D from './components/panels/RollRibbonsDtw3D';
import OrientationDtw3D from './components/panels/OrientationDtw3D';
import { parseTSV, fixTimestamps } from './utils/tsvParser';
import { runDtwPipeline } from './utils/dtwPipeline';
import type { DtwComparisonData } from './types/dtw';
import type { ReactNode } from 'react';

// ─── PanelCard ────────────────────────────────────────────────────────────────

const HEADER_H = 36;

function PanelCard({
  title,
  width = 500,
  height = 456,
  children,
}: {
  title: string;
  width?: number;
  height?: number;
  children: ReactNode;
}) {
  return (
    <div
      data-panel=""
      style={{
        width,
        height,
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 2px 12px rgba(0,0,0,0.13)',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'default',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          height: HEADER_H,
          padding: '0 12px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          alignItems: 'center',
          fontSize: 13,
          fontWeight: 500,
          color: '#333',
          flexShrink: 0,
          background: '#fafafa',
          userSelect: 'none',
        }}
      >
        {title}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

// ─── TabBar ───────────────────────────────────────────────────────────────────

const TABS: { id: AppTab; label: string }[] = [
  { id: 'motion', label: 'Движение' },
  { id: 'tremor', label: 'Тремор' },
  { id: 'comparison', label: 'Сравнение' },
];

function TabBar() {
  const { activeTab, setActiveTab } = useData();

  return (
    <div style={{
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '0 16px',
      height: 40,
      borderBottom: '1px solid #e5e4e7',
      background: '#fafafa',
    }}>
      {TABS.map(tab => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              height: 28,
              padding: '0 16px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              color: active ? '#fff' : '#555',
              background: active ? '#534AB7' : 'transparent',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Motion tab ───────────────────────────────────────────────────────────────

function MotionTab() {
  const { vizData, currentIndex } = useData();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>

      <div style={{ display: 'flex', gap: 16 }}>
        <PanelCard title="3D Лента углов во времени" width={500} height={456}>
          <AngleRibbon3D data={vizData} currentIndex={currentIndex} />
        </PanelCard>
        <PanelCard title="3D След со временем" width={500} height={456}>
          <TipTrailTimeline3D data={vizData} currentIndex={currentIndex} />
        </PanelCard>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <PanelCard title="3D Углы Эйлера (Roll, Pitch, Yaw)" width={500} height={456}>
          <AngleTimeline data={vizData} currentIndex={currentIndex} />
        </PanelCard>
        <PanelCard title="Профиль интенсивности движения" width={500} height={456}>
          <IntensityProfile />
        </PanelCard>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <PanelCard title="Карта ориентации (Roll vs Pitch)" width={500} height={456}>
          <OrientationMap />
        </PanelCard>
        <PanelCard title="Фазовый портрет" width={500} height={456}>
          <PhasePortrait />
        </PanelCard>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <PanelCard title="Спектр тремора (FFT)" width={500} height={456}>
          <TremorSpectrum />
        </PanelCard>
      </div>

    </div>
  );
}

// ─── Tremor tab ───────────────────────────────────────────────────────────────

function TremorTab() {
  const { tremorData, isProcessing, rows } = useData();

  if (rows.length < 100) {
    return (
      <div style={{ padding: 32, color: '#aaa', fontSize: 14 }}>
        Загрузите TSV файл для анализа тремора
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div style={{ padding: 32, color: '#888', fontSize: 14 }}>
        Анализ тремора...
      </div>
    );
  }

  if (!tremorData) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>

      <div style={{ display: 'flex', gap: 16 }}>
        <PanelCard title="Разделение движений (CDF)" width={500} height={420}>
          <VoluntaryVsTremor data={tremorData} />
        </PanelCard>
        <PanelCard title="Мгновенная частота тремора" width={500} height={420}>
          <TremorFrequency data={tremorData} />
        </PanelCard>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <PanelCard title="Амплитуда тремора (Kalman)" width={500} height={320}>
          <TremorAmplitude data={tremorData} />
        </PanelCard>
        <PanelCard title="Спектрограмма тремора" width={500} height={420}>
          <TremorSpectrogram spectrogram={tremorData.spectrogram} />
        </PanelCard>
      </div>

    </div>
  );
}

// ─── Comparison tab ───────────────────────────────────────────────────────────

// Row 3+4 total width: 600 + 16 + 600 = 1216px
const ROW34_W = 1216;

function ComparisonPanels({ data }: { data: DtwComparisonData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>

      {/* Строка 1: Roll во времени + Траектории */}
      <div style={{ display: 'flex', gap: 16 }}>
        <PanelCard title="Roll во времени" width={500} height={420}>
          <RollComparison data={data} />
        </PanelCard>
        <PanelCard title="Траектории Roll vs Pitch" width={500} height={420}>
          <TrajectoryComparison data={data} />
        </PanelCard>
      </div>

      {/* Строка 2: DTW-матрица + Tip-траектории */}
      <div style={{ display: 'flex', gap: 16 }}>
        <PanelCard title="DTW-матрица выравнивания" width={500} height={520}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <DtwAlignmentMatrix data={data} width={460} height={460} />
          </div>
        </PanelCard>
        <PanelCard title="Tip-траектории (tipX vs tipY)" width={500} height={420}>
          <TipComparison data={data} />
        </PanelCard>
      </div>

      {/* Строка 3: 3D-следы + 3D-ленты */}
      <div style={{ display: 'flex', gap: 16 }}>
        <PanelCard title="3D-следы кончиков + DTW" width={600} height={520}>
          <TipTrailDtw3D data={data} />
        </PanelCard>
        <PanelCard title="3D-ленты Roll + DTW" width={600} height={520}>
          <RollRibbonsDtw3D data={data} />
        </PanelCard>
      </div>

      {/* Строка 4: Roll × Pitch × Время — полная ширина */}
      <PanelCard title="3D Roll × Pitch × Время + DTW" width={ROW34_W} height={540}>
        <OrientationDtw3D data={data} />
      </PanelCard>

    </div>
  );
}

function ComparisonTab() {
  const [file1, setFile1] = useState<string | null>(null);
  const [name1, setName1] = useState('');
  const [comparison, setComparison] = useState<DtwComparisonData | null>(null);
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
      const result = runDtwPipeline(file1, await f.text(), name1, f.name);
      setComparison(result);
    } catch (err) {
      console.error('DTW pipeline error:', err);
    } finally {
      setLoading(false);
    }
  }, [file1, name1]);

  const sep = <div style={{ width: 1, height: 22, background: '#e5e4e7', flexShrink: 0 }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* ── Панель управления ── */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        height: 48,
        borderBottom: '1px solid #e5e4e7',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden',
        flexWrap: 'nowrap',
      }}>

        {/* File inputs */}
        <label style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Запись 1:
        </label>
        <input
          type="file" accept=".txt,.tsv"
          onChange={handleFile1}
          style={{ fontSize: 12, flexShrink: 0, maxWidth: 180 }}
        />

        {sep}

        <label style={{
          fontSize: 12,
          color: file1 ? '#666' : '#bbb',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          Запись 2:
        </label>
        <input
          type="file" accept=".txt,.tsv"
          onChange={handleFile2}
          disabled={!file1}
          style={{ fontSize: 12, flexShrink: 0, maxWidth: 180 }}
        />

        {loading && (
          <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Вычисление DTW...
          </span>
        )}

        {/* Metrics */}
        {comparison && (
          <>
            {sep}
            <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {comparison.rec1.label}: <b>{comparison.rec1.duration.toFixed(1)}с</b>
            </span>
            <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {comparison.rec2.label}: <b>{comparison.rec2.duration.toFixed(1)}с</b>
            </span>
            {sep}
            <span style={{ fontSize: 13, fontWeight: 600, color: '#534AB7', whiteSpace: 'nowrap', flexShrink: 0 }}>
              DTW {comparison.dtwEuler.distance}°
            </span>
            <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap', flexShrink: 0 }}>
              ({comparison.dtwEuler.normalized} °/шаг)
            </span>
          </>
        )}
      </div>

      {/* ── Виртуальный канвас с панелями ── */}
      <VirtualCanvas initialX={32} initialY={32}>
        {comparison ? (
          <ComparisonPanels data={comparison} />
        ) : (
          <div style={{ padding: 32, color: '#aaa', fontSize: 14 }}>
            {file1
              ? 'Теперь загрузите Запись 2'
              : 'Загрузите два TSV-файла для сравнения траекторий'}
          </div>
        )}
      </VirtualCanvas>

    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard() {
  const { rows, setRows, vizData, activeTab, currentIndex, setCurrentIndex } = useData();

  const handleData = (raw: string) => {
    const parsed = fixTimestamps(parseTSV(raw));
    setRows(parsed);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* ── Шапка ── */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        height: 52,
        borderBottom: '1px solid #e5e4e7',
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        zIndex: 10,
        flexWrap: 'nowrap',
        overflow: 'hidden',
      }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#08060d', whiteSpace: 'nowrap', flexShrink: 0 }}>
          IMU Motion
        </span>

        <div style={{ width: 1, height: 22, background: '#e5e4e7', flexShrink: 0 }} />

        <FileUploader onData={handleData} />

        {rows.length > 0 && (
          <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {rows.length} кадров
          </span>
        )}

        {vizData && (
          <>
            <div style={{ width: 1, height: 22, background: '#e5e4e7', flexShrink: 0 }} />

            <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {vizData.recording.duration.toFixed(1)}s
            </span>
            <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Roll [{Math.min(...vizData.recording.angleX).toFixed(0)}°,{' '}
              {Math.max(...vizData.recording.angleX).toFixed(0)}°]
            </span>
            <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Pitch [{Math.min(...vizData.recording.angleY).toFixed(0)}°,{' '}
              {Math.max(...vizData.recording.angleY).toFixed(0)}°]
            </span>

            <div style={{ width: 1, height: 22, background: '#e5e4e7', flexShrink: 0 }} />

            <div style={{ width: 260, flexShrink: 0 }}>
              <PlaybackControls
                frameCount={vizData.recording.length}
                currentIndex={currentIndex}
                onIndexChange={setCurrentIndex}
                currentTime={vizData.recording.t[currentIndex]}
              />
            </div>

            <span style={{ fontSize: 13, fontWeight: 600, color: '#E24B4A', whiteSpace: 'nowrap', flexShrink: 0 }}>
              R {vizData.recording.angleX[currentIndex]?.toFixed(1)}°
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1D9E75', whiteSpace: 'nowrap', flexShrink: 0 }}>
              P {vizData.recording.angleY[currentIndex]?.toFixed(1)}°
            </span>
          </>
        )}
      </div>

      {/* ── Таб-бар ── */}
      <TabBar />

      {/* ── Контент вкладок ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, display: activeTab === 'motion' ? 'flex' : 'none', flexDirection: 'column' }}>
          <VirtualCanvas initialX={32} initialY={32}>
            <MotionTab />
          </VirtualCanvas>
        </div>
        <div style={{ position: 'absolute', inset: 0, display: activeTab === 'tremor' ? 'flex' : 'none', flexDirection: 'column' }}>
          <VirtualCanvas initialX={32} initialY={32}>
            <TremorTab />
          </VirtualCanvas>
        </div>
        <div style={{ position: 'absolute', inset: 0, display: activeTab === 'comparison' ? 'flex' : 'none', flexDirection: 'column' }}>
          <ComparisonTab />
        </div>
      </div>

    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <Dashboard />
    </DataProvider>
  );
}
