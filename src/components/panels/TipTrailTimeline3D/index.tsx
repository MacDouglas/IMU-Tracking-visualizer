// components/panels/TipTrailTimeline3D/index.tsx
//
// v2_6: 3D-след кончика датчика со временем
//
// Input data: Q0, Q1, Q2, Q3 (quaternions), time t
// Processing:
//   - For each sample: rotate vector [0, 0, 1.8] by quaternion → tipX, tipY
//   - z coordinate = normalized time: (t / tMax) * 3 - 1.5
//   - This "unrolls" circular loops into a ribbon along the time axis
// Rendering:
//   - Main 3D trail line with gradient color (green → purple)
//   - Floor shadow: same tipX, tipZ=zTime, y=-2 (projection)
//   - Vertical drop lines every Nth point connecting trail to shadow
//   - Current tip: green sphere
//   - Start: red sphere
//   - Floor grid + time labels for depth

import { useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { ImuVisualizationData } from '../../../types/imu';

/** Wrapper around THREE.Line to avoid JSX <line> conflict with SVG types */
function Line3({
  geometry,
  color,
  linewidth,
  transparent,
  opacity,
  vertexColors,
}: {
  geometry: THREE.BufferGeometry;
  color?: string | number;
  linewidth?: number;
  transparent?: boolean;
  opacity?: number;
  vertexColors?: boolean;
}) {
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color, linewidth, transparent, opacity, vertexColors }),
    [color, linewidth, transparent, opacity, vertexColors],
  );
  const obj = useMemo(() => new THREE.Line(geometry, mat), [geometry, mat]);
  return <primitive object={obj} />;
}

interface TipTrailTimeline3DProps {
  data?: ImuVisualizationData | null;
  /** Current playback index (0..length-1) */
  currentIndex: number;
}

const FLOOR_Y = -2;

/** Precompute all trail and shadow points */
function useTrailGeometry(data: ImuVisualizationData) {
  return useMemo(() => {
    const { recording, derived } = data;
    const N = recording.length;
    const tMax = recording.duration;

    const trail: THREE.Vector3[] = [];
    const shadow: THREE.Vector3[] = [];

    for (let i = 0; i < N; i++) {
      const zTime = (recording.t[i] / tMax) * 3 - 1.5;
      trail.push(new THREE.Vector3(derived.tipX[i], derived.tipY[i], zTime));
      shadow.push(new THREE.Vector3(derived.tipX[i], FLOOR_Y, zTime));
    }

    return { trail, shadow, N, tMax };
  }, [data]);
}

/** Gradient-colored trail line using vertex colors */
function GradientTrail({
  points,
  currentIndex,
}: {
  points: THREE.Vector3[];
  currentIndex: number;
}) {
  const geom = useMemo(() => {
    if (points.length < 2) return null;
    const N = points.length;
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    // Pre-compute full gradient — color at index i reflects its position in time
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
  return <Line3 geometry={geom} vertexColors linewidth={2} />;
}

/** Shadow line on the floor */
function ShadowTrail({
  points,
  currentIndex,
}: {
  points: THREE.Vector3[];
  currentIndex: number;
}) {
  const geom = useMemo(() => {
    if (points.length < 2) return null;
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);
  useEffect(() => () => geom?.dispose(), [geom]);

  useEffect(() => {
    geom?.setDrawRange(0, currentIndex + 1);
  }, [geom, currentIndex]);

  if (!geom) return null;
  return <Line3 geometry={geom} color="#000000" transparent opacity={0.08} />;
}

/** Vertical drop lines connecting trail to shadow */
function DropLines({
  trail,
  shadow,
  currentIndex,
  every = 6,
}: {
  trail: THREE.Vector3[];
  shadow: THREE.Vector3[];
  currentIndex: number;
  every?: number;
}) {
  // Pre-create all geometries once, then show/hide via drawRange
  const allGeoms = useMemo(() => {
    const result: { geom: THREE.BufferGeometry; idx: number }[] = [];
    for (let i = 0; i < trail.length; i += every) {
      result.push({
        geom: new THREE.BufferGeometry().setFromPoints([trail[i], shadow[i]]),
        idx: i,
      });
    }
    return result;
  }, [trail, shadow, every]);
  useEffect(() => () => { allGeoms.forEach(({ geom }) => geom.dispose()); }, [allGeoms]);

  useEffect(() => {
    for (const { geom, idx } of allGeoms) {
      geom.setDrawRange(0, idx <= currentIndex ? 2 : 0);
    }
  }, [allGeoms, currentIndex]);

  return (
    <group>
      {allGeoms.map(({ geom, idx }) => (
        <Line3 key={idx} geometry={geom} color="#1D9E75" transparent opacity={0.07} />
      ))}
    </group>
  );
}

/** Floor grid */
function FloorGrid() {
  const geoms = useMemo(() => {
    const result: THREE.BufferGeometry[] = [];
    for (let g = -1.5; g <= 1.5; g += 0.5) {
      result.push(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2, FLOOR_Y, g), new THREE.Vector3(2, FLOOR_Y, g)]));
      result.push(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(g, FLOOR_Y, -1.5), new THREE.Vector3(g, FLOOR_Y, 1.5)]));
    }
    return result;
  }, []);

  return (
    <group>
      {geoms.map((geom, i) => (
        <Line3 key={i} geometry={geom} color="#888888" transparent opacity={0.06} />
      ))}
    </group>
  );
}

/** Time labels on the floor edge */
function TimeLabels({ tMax }: { tMax: number }) {
  const labels = [0, 10, 20, 30].filter(s => s <= tMax);
  return (
    <group>
      {labels.map(sec => {
        const z = (sec / tMax) * 3 - 1.5;
        return (
          <Text
            key={sec}
            position={[-2.2, FLOOR_Y, z]}
            fontSize={0.12}
            color="#888888"
            anchorX="right"
            anchorY="middle"
          >
            {sec}s
          </Text>
        );
      })}
    </group>
  );
}

/** Main 3D scene */
function Scene({ data, currentIndex }: TipTrailTimeline3DProps) {
  const { trail, shadow, N, tMax } = useTrailGeometry(data!);

  return (
    <>
      <ambientLight intensity={0.6} />

      <FloorGrid />
      <TimeLabels tMax={tMax} />

      {/* Shadow on floor */}
      <ShadowTrail points={shadow} currentIndex={currentIndex} />

      {/* Vertical connectors */}
      <DropLines trail={trail} shadow={shadow} currentIndex={currentIndex} />

      {/* Main 3D trail with gradient */}
      <GradientTrail points={trail} currentIndex={currentIndex} />

      {/* Start marker — red */}
      {currentIndex > 0 && (
        <mesh position={trail[0]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color="#E24B4A" />
        </mesh>
      )}

      {/* Current tip — green */}
      <mesh position={trail[Math.min(currentIndex, N - 1)]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color="#1D9E75" />
      </mesh>

      <OrbitControls
        enablePan={true}
        enableZoom={true}
      />
    </>
  );
}

/** Wrapper component */
export default function TipTrailTimeline3D({ data, currentIndex }: TipTrailTimeline3DProps) {
  if (!data) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 13 }}>
        Загрузите TSV файл
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 400 }}>
      <Canvas
        camera={{ position: [3, 1.5, 3], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <Scene data={data} currentIndex={currentIndex} />
      </Canvas>
    </div>
  );
}
