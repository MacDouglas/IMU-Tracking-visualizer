import { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useData } from '../../DataContext/context';
import { quaternionFromR } from '../../../utils/orientation';

// ─── HandModel ────────────────────────────────────────────────────────────────

/**
 * Hand in sensor axes (Install Direction = Horizontal, sensor on the back of the hand):
 * X — along the forearm towards the fingers (Roll axis), Y — across the palm, Z — normal to the back of the hand.
 */
function HandModel({ quaternion }: { quaternion: THREE.Quaternion }) {
  return (
    <group quaternion={quaternion}>
      {/* Palm: long along X, thin along Z; three.js box args are (x, y, z) in sensor axes before C */}
      <mesh>
        <boxGeometry args={[1.4, 1.0, 0.25]} />
        <meshStandardMaterial color="#5588ff" />
      </mesh>
      {/* Finger direction — cone pointing +X */}
      <mesh position={[0.85, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.16, 0.65, 8]} />
        <meshStandardMaterial color="#ff8844" />
      </mesh>
      {/* Wrist nub — marks −X end */}
      <mesh position={[-0.65, 0, 0]}>
        <boxGeometry args={[0.28, 0.5, 0.3]} />
        <meshStandardMaterial color="#3366dd" />
      </mesh>
    </group>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────

function Scene({ quaternion }: { quaternion: THREE.Quaternion | null }) {
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
      {quaternion !== null && <HandModel quaternion={quaternion} />}
    </>
  );
}

// ─── OrientationModel ─────────────────────────────────────────────────────────

export default function OrientationModel() {
  const { rows, extras } = useData();
  const [frameIndex, setFrameIndex] = useState(0);

  const clampedIndex = rows.length > 0 ? Math.min(frameIndex, rows.length - 1) : 0;
  const currentTime = rows.length > 0 ? rows[clampedIndex].time.toFixed(2) : '—';
  const quaternion = useMemo(
    () => (extras && rows.length > 0 ? quaternionFromR(extras.R, clampedIndex) : null),
    [extras, rows.length, clampedIndex],
  );

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#1a1a2e' }}>
      <Canvas camera={{ position: [3, 2.5, 3.5], fov: 45 }} style={{ width: '100%', height: '100%' }}>
        <Scene quaternion={quaternion} />
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
