// components/panels/Trajectory3D/index.tsx
//
// v5.1: 3D-траектория руки (мм, относительно старта)
//
// Input data: vizData.trajectory — computeTrajectory (ZUPT + lever arm), sampled at vizData.indices
//   итог    = trajX/Y/Z  (перенос + поворот)
//   перенос = baseX/Y/Z  (центр вращения, ZUPT)
//   поворот = rotX/Y/Z   (датчик вокруг центра вращения, рычаг)
// Processing:
//   - room axes (Z up) → three.js (Y up): (x, y, z) → (x, z, −y)
//   - one scale for all three modes (max |coord| over all of them → 1.5 units),
//     so switching modes shows true relative size
//   - grid step: "nice" number of mm (1/2/5·10^k)
// Rendering:
//   - trail with time gradient (green → purple), drawn up to currentIndex
//   - stationary samples (velocity zeroed) as grey dots
//   - start: red sphere, current: green sphere

import { useMemo, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { ImuVisualizationData, VizTrajectory } from '../../../types/imu';
import {
  TRAJECTORY_MODES as MODES, ACCURACY_HINT, modeArrays, niceStep, type TrajectoryMode,
} from '../../../utils/trajectoryViz';

/** Wrapper around THREE.Line to avoid JSX <line> conflict with SVG types */
function Line3({
  geometry,
  color,
  transparent,
  opacity,
  vertexColors,
}: {
  geometry: THREE.BufferGeometry;
  color?: string | number;
  transparent?: boolean;
  opacity?: number;
  vertexColors?: boolean;
}) {
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent, opacity, vertexColors }),
    [color, transparent, opacity, vertexColors],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const obj = useMemo(() => new THREE.Line(geometry, mat), [geometry, mat]);
  return <primitive object={obj} />;
}

const SCENE_HALF = 1.5;

function useScale(tr: VizTrajectory) {
  return useMemo(() => {
    let maxAbs = 0;
    for (const mode of MODES) {
      for (const arr of modeArrays(tr, mode.id)) {
        for (const v of arr) if (Number.isFinite(v)) maxAbs = Math.max(maxAbs, Math.abs(v));
      }
    }
    maxAbs = Math.max(maxAbs, 1); // at least ±1 mm, avoids /0 for a still recording
    const step = niceStep(maxAbs / 3);
    return { scale: SCENE_HALF / maxAbs, stepMm: step, maxAbs };
  }, [tr]);
}

function usePoints(tr: VizTrajectory, mode: TrajectoryMode, scale: number) {
  return useMemo(() => {
    const [x, y, z] = modeArrays(tr, mode);
    // room (x, y, z), Z up → three (x, z, −y), Y up
    return x.map((_, i) => new THREE.Vector3(x[i] * scale, z[i] * scale, -y[i] * scale));
  }, [tr, mode, scale]);
}

function GradientTrail({ points, currentIndex }: { points: THREE.Vector3[]; currentIndex: number }) {
  const geom = useMemo(() => {
    if (points.length < 2) return null;
    const N = points.length;
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const colors = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      // Green (29,158,117) → Purple (83,74,183)
      colors[i * 3] = (29 + f * 54) / 255;
      colors[i * 3 + 1] = (158 - f * 84) / 255;
      colors[i * 3 + 2] = (117 + f * 66) / 255;
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  }, [points]);
  useEffect(() => () => geom?.dispose(), [geom]);

  useEffect(() => {
    geom?.setDrawRange(0, currentIndex + 1);
  }, [geom, currentIndex]);

  if (!geom) return null;
  return <Line3 geometry={geom} vertexColors />;
}

/** Grey dots at stationary samples (ZUPT zeroed the velocity there) */
function StillDots({ points, still, currentIndex }: { points: THREE.Vector3[]; still: number[]; currentIndex: number }) {
  const geom = useMemo(() => {
    const pts = points.filter((_, i) => still[i] === 1 && i <= currentIndex);
    return pts.length ? new THREE.BufferGeometry().setFromPoints(pts) : null;
  }, [points, still, currentIndex]);
  useEffect(() => () => geom?.dispose(), [geom]);
  const mat = useMemo(() => new THREE.PointsMaterial({ color: '#8a8a8a', size: 0.09 }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const obj = useMemo(() => (geom ? new THREE.Points(geom, mat) : null), [geom, mat]);
  if (!obj) return null;
  return <primitive object={obj} />;
}

/** Floor grid in "nice" mm steps + axis labels */
function FloorGrid({ stepUnits, stepMm }: { stepUnits: number; stepMm: number }) {
  const floorY = -SCENE_HALF;
  const geoms = useMemo(() => {
    const result: THREE.BufferGeometry[] = [];
    const n = Math.floor(SCENE_HALF / stepUnits);
    for (let k = -n; k <= n; k++) {
      const g = k * stepUnits;
      result.push(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-SCENE_HALF, floorY, g), new THREE.Vector3(SCENE_HALF, floorY, g)]));
      result.push(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(g, floorY, -SCENE_HALF), new THREE.Vector3(g, floorY, SCENE_HALF)]));
    }
    return result;
  }, [stepUnits, floorY]);
  useEffect(() => () => { geoms.forEach(g => g.dispose()); }, [geoms]);

  return (
    <group>
      {geoms.map((geom, i) => (
        <Line3 key={i} geometry={geom} color="#888888" transparent opacity={0.12} />
      ))}
      <Text position={[SCENE_HALF + 0.15, floorY, 0]} fontSize={0.12} color="#E24B4A">X</Text>
      <Text position={[0, floorY, -SCENE_HALF - 0.15]} fontSize={0.12} color="#1D9E75">Y</Text>
      <Text position={[-SCENE_HALF, SCENE_HALF, -SCENE_HALF]} fontSize={0.12} color="#4A8FE2">Z ↑</Text>
      <Text position={[-SCENE_HALF - 0.1, floorY, SCENE_HALF + 0.15]} fontSize={0.1} color="#888888" anchorX="left">
        {`сетка ${stepMm} мм`}
      </Text>
    </group>
  );
}

function Scene({ tr, mode, currentIndex }: { tr: VizTrajectory; mode: TrajectoryMode; currentIndex: number }) {
  const { scale, stepMm } = useScale(tr);
  const points = usePoints(tr, mode, scale);
  const N = points.length;
  const cur = points[Math.min(currentIndex, N - 1)];

  return (
    <>
      <ambientLight intensity={0.6} />
      <FloorGrid stepUnits={stepMm * scale} stepMm={stepMm} />
      <StillDots points={points} still={tr.still} currentIndex={currentIndex} />
      <GradientTrail points={points} currentIndex={currentIndex} />

      <mesh position={points[0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color="#E24B4A" />
      </mesh>
      {cur && (
        <mesh position={cur}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color="#1D9E75" />
        </mesh>
      )}

      <OrbitControls enablePan enableZoom />
    </>
  );
}

interface Trajectory3DProps {
  data?: ImuVisualizationData | null;
  currentIndex: number;
}

const EMPTY_STYLE: React.CSSProperties = {
  width: '100%', height: '100%', display: 'flex', alignItems: 'center',
  justifyContent: 'center', color: '#aaa', fontSize: 13, padding: 24, textAlign: 'center',
};

export default function Trajectory3D({ data, currentIndex }: Trajectory3DProps) {
  const [mode, setMode] = useState<TrajectoryMode>('total');

  if (!data) return <div style={EMPTY_STYLE}>Загрузите TSV файл</div>;
  const tr = data.trajectory;
  if (!tr) return <div style={EMPTY_STYLE}>Траектория не рассчитана: запись слишком короткая</div>;

  const leverCm = Math.hypot(...tr.leverM) * 100;
  const btnStyle = (m: TrajectoryMode): React.CSSProperties => ({
    padding: '1px 8px',
    fontSize: 11,
    border: '1px solid #d0d0d0',
    borderRadius: 4,
    background: mode === m ? '#534AB7' : '#fff',
    color: mode === m ? '#fff' : '#555',
    cursor: 'pointer',
    marginLeft: 4,
  });

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        title={ACCURACY_HINT}
        style={{
          padding: '6px 12px 2px', fontSize: 11, color: '#888', flexShrink: 0,
          borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center',
        }}
      >
        мм, относительно старта · рычаг {leverCm.toFixed(1)} см
        <span style={{ marginLeft: 6, color: '#bbb', cursor: 'help' }}>ⓘ</span>
        <span style={{ flex: 1 }} />
        {MODES.map(m => (
          <button key={m.id} style={btnStyle(m.id)} title={m.hint} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Canvas camera={{ position: [2.2, 1.8, 2.2], fov: 50 }} style={{ background: 'transparent' }}>
          <Scene tr={tr} mode={mode} currentIndex={currentIndex} />
        </Canvas>
      </div>
      <div style={{ padding: '2px 12px 6px', fontSize: 10, color: '#aaa', flexShrink: 0 }}>
        <span style={{ color: '#9a9a9a' }}>●</span> покой (скорость обнулена) · {ACCURACY_HINT}
      </div>
    </div>
  );
}
