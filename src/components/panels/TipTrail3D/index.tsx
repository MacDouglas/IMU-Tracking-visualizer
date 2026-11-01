import { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Line } from '@react-three/drei';
import { useData } from '../../DataContext/context';
import { downsampleIndices } from '../../../utils/signalProcessing';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrailData {
  points: [number, number, number][];
  colors: [number, number, number][];
  floorPoints: [number, number, number][];
  connectorPoints: [number, number, number][];
  /** Full-resolution row index of each trail point */
  indices: number[];
}

// ─── Scene ────────────────────────────────────────────────────────────────────

function TrailScene({
  trailData,
  markerPos,
}: {
  trailData: TrailData | null;
  markerPos: [number, number, number];
}) {
  return (
    <>
      <ambientLight intensity={0.8} />
      <OrbitControls enableDamping dampingFactor={0.08} />
      <Grid
        args={[8, 8]}
        position={[0, -2.3, 0]}
        cellSize={0.4}
        cellThickness={0.4}
        cellColor="#334433"
        sectionSize={2}
        sectionThickness={0.8}
        sectionColor="#446644"
        fadeDistance={10}
        fadeStrength={1.5}
        infiniteGrid
      />

      {trailData !== null && trailData.points.length >= 2 && (
        <>
          {/* Main trail — green → purple */}
          <Line points={trailData.points} vertexColors={trailData.colors} lineWidth={2.5} />

          {/* Floor shadow */}
          <Line
            points={trailData.floorPoints}
            vertexColors={trailData.colors}
            lineWidth={1}
            transparent
            opacity={0.3}
          />

          {/* Vertical connectors every 6 points */}
          {trailData.connectorPoints.length >= 2 && (
            <Line
              points={trailData.connectorPoints}
              color="#888888"
              lineWidth={0.8}
              segments
            />
          )}

          {/* Current frame marker */}
          <mesh position={markerPos}>
            <sphereGeometry args={[0.06, 12, 8]} />
            <meshBasicMaterial color="#ffff44" />
          </mesh>
        </>
      )}
    </>
  );
}

// ─── TipTrail3D ───────────────────────────────────────────────────────────────

export default function TipTrail3D() {
  const { rows, extras } = useData();
  const [frameIndex, setFrameIndex] = useState(0);

  // Precompute all geometry — only reruns when the session changes
  const trailData = useMemo((): TrailData | null => {
    if (rows.length < 2 || !extras) return null;

    const indices = downsampleIndices(rows.length, 300);
    const N = indices.length;
    const tMax = rows[rows.length - 1].time;

    const points: [number, number, number][] = [];
    const colors: [number, number, number][] = [];
    const floorPoints: [number, number, number][] = [];
    const connectorPoints: [number, number, number][] = [];

    for (let i = 0; i < N; i++) {
      const row = indices[i];
      // tip = 3rd column of R × 1.8 (Euler angles, 100 Hz) — v5.1
      const tipX = extras.tip.x[row];
      const tipY = extras.tip.y[row];
      const z = tMax > 0 ? (rows[row].time / tMax) * 3 - 1.5 : 0;

      const f = N > 1 ? i / (N - 1) : 0;
      const color: [number, number, number] = [0.5 * f, 1 - f, 0.5 * f];

      points.push([tipX, tipY, z]);
      colors.push(color);
      floorPoints.push([tipX, -2.0, z]);

      if (i % 6 === 0) {
        connectorPoints.push([tipX, tipY, z]);
        connectorPoints.push([tipX, -2.0, z]);
      }
    }

    return { points, colors, floorPoints, connectorPoints, indices };
  }, [rows, extras]);

  // Map full-resolution frameIndex to the last trail point not after it
  const markerPos = useMemo((): [number, number, number] => {
    if (trailData === null) return [0, 0, 0];
    let k = 0;
    while (k + 1 < trailData.indices.length && trailData.indices[k + 1] <= frameIndex) k++;
    return trailData.points[k] ?? [0, 0, 0];
  }, [trailData, frameIndex]);

  const clampedIndex = rows.length > 0 ? Math.min(frameIndex, rows.length - 1) : 0;
  const currentTime = rows.length > 0 ? rows[clampedIndex].time.toFixed(2) : '—';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0d1a0d' }}>
      <Canvas camera={{ position: [0, 2, 5], fov: 50 }} style={{ width: '100%', height: '100%' }}>
        <TrailScene trailData={trailData} markerPos={markerPos} />
      </Canvas>

      {rows.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#88cc88', pointerEvents: 'none', fontSize: 14,
        }}>
          Загрузите TSV файл для отображения следа
        </div>
      )}

      {rows.length > 0 && (
        <div style={{
          position: 'absolute', top: 8, left: 12,
          color: '#aaffaa', fontSize: 12, pointerEvents: 'none',
        }}>
          t = {currentTime} s &nbsp;|&nbsp; {clampedIndex + 1} / {rows.length}
        </div>
      )}

      {rows.length > 1 && (
        <div style={{ position: 'absolute', bottom: 8, left: 12, right: 12 }}>
          <input
            type="range"
            min={0}
            max={rows.length - 1}
            value={clampedIndex}
            onChange={e => setFrameIndex(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      )}
    </div>
  );
}
