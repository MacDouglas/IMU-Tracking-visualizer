import { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useData } from '../../DataContext/context';
import type { SensorRow } from '../../../utils/tsvParser';

// ─── HandModel ────────────────────────────────────────────────────────────────

function HandModel({ row }: { row: SensorRow }) {
  // WitMotion: q0=w, q1=x, q2=y, q3=z → THREE.Quaternion(x, y, z, w)
  const quaternion = useMemo(
    () => new THREE.Quaternion(row.q1, row.q2, row.q3, row.q0).normalize(),
    [row.q0, row.q1, row.q2, row.q3],
  );

  return (
    <group quaternion={quaternion}>
      {/* Palm */}
      <mesh>
        <boxGeometry args={[1.4, 0.25, 1.0]} />
        <meshStandardMaterial color="#5588ff" />
      </mesh>
      {/* Finger direction — cone pointing +Z */}
      <mesh position={[0, 0, 0.85]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.16, 0.65, 8]} />
        <meshStandardMaterial color="#ff8844" />
      </mesh>
      {/* Wrist nub — marks −Z end */}
      <mesh position={[0, 0, -0.65]}>
        <boxGeometry args={[0.5, 0.3, 0.28]} />
        <meshStandardMaterial color="#3366dd" />
      </mesh>
    </group>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────

function Scene({ row }: { row: SensorRow | null }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 8, 5]} intensity={1.0} />
      <Grid
        args={[10, 10]}
        position={[0, -1.2, 0]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#444466"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#6666aa"
        fadeDistance={12}
        fadeStrength={1.5}
        infiniteGrid
      />
      <OrbitControls enableDamping dampingFactor={0.08} />
      {row !== null && <HandModel row={row} />}
    </>
  );
}

// ─── OrientationModel ─────────────────────────────────────────────────────────

export default function OrientationModel() {
  const { rows } = useData();
  const [frameIndex, setFrameIndex] = useState(0);

  const clampedIndex = rows.length > 0 ? Math.min(frameIndex, rows.length - 1) : 0;
  const currentRow = rows.length > 0 ? rows[clampedIndex] : null;
  const currentTime = currentRow?.time.toFixed(2) ?? '—';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#1a1a2e' }}>
      <Canvas camera={{ position: [3, 2.5, 3.5], fov: 45 }} style={{ width: '100%', height: '100%' }}>
        <Scene row={currentRow} />
      </Canvas>

      {rows.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#aaaacc', pointerEvents: 'none', fontSize: 14,
        }}>
          Загрузите TSV файл для 3D модели
        </div>
      )}

      {rows.length > 0 && (
        <div style={{
          position: 'absolute', top: 8, left: 12,
          color: '#ccccff', fontSize: 12, pointerEvents: 'none',
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
