// components/panels/AngleRibbon3D/index.tsx
//
// v2_5: 3D-лента углов во времени
//
// Input data: angleX (Roll), angleY (Pitch), time t
// Processing:
//   - Roll normalized: Roll / rollScale * 2 (maps to ~±2 range in 3D)
//   - Pitch normalized: Pitch / pitchScale * 2
//   - Time normalized: (t / tMax) * 3 - 1.5 (maps to -1.5..+1.5)
// Rendering:
//   - Red ribbon in vertical plane: points (0, rollNorm, zTime) with fill to zero line
//   - Green ribbon in horizontal plane: points (pitchNorm, 0, zTime) with fill to zero line
//   - Purple combined line: points (pitchNorm, rollNorm, zTime)
//   - Floor grid for depth perception
//   - Current position dots on each ribbon

import { useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [color, linewidth, transparent, opacity, vertexColors],
  );
  const obj = useMemo(() => new THREE.Line(geometry, mat), [geometry, mat]);
  return <primitive object={obj} />;
}

interface AngleRibbon3DProps {
  data?: ImuVisualizationData | null;
  /** Current playback index (0..data.recording.length-1) */
  currentIndex: number;
}

// Normalize angles and time into 3D scene coordinates
function useRibbonGeometry(data: ImuVisualizationData) {
  return useMemo(() => {
    const { recording } = data;
    const N = recording.length;
    const tMax = recording.duration;

    // Scale factors — chosen so both ribbons fit in ~±2 range
    const rollScale = Math.max(
      Math.abs(Math.min(...recording.angleX)),
      Math.abs(Math.max(...recording.angleX)),
      1
    );
    const pitchScale = Math.max(
      Math.abs(Math.min(...recording.angleY)),
      Math.abs(Math.max(...recording.angleY)),
      1
    );

    const rollNorm = new Float32Array(N);
    const pitchNorm = new Float32Array(N);
    const zTime = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      rollNorm[i] = (recording.angleX[i] / rollScale) * 2;
      pitchNorm[i] = (recording.angleY[i] / pitchScale) * 2;
      zTime[i] = (recording.t[i] / tMax) * 3 - 1.5;
    }

    return { rollNorm, pitchNorm, zTime, N, rollScale, pitchScale };
  }, [data]);
}

/** Single ribbon as a line + transparent mesh fill */
function Ribbon({
  points,
  zeroPoints,
  color,
  currentIndex,
}: {
  points: THREE.Vector3[];
  zeroPoints: THREE.Vector3[];
  color: string;
  currentIndex: number;
}) {
  // Create full geometry once — drawRange controls visible count
  const lineGeom = useMemo(() =>
    new THREE.BufferGeometry().setFromPoints(points),
  [points]);
  useEffect(() => () => lineGeom.dispose(), [lineGeom]);

  const fillGeom = useMemo(() => {
    if (points.length < 2) return null;
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i < points.length; i++) {
      vertices.push(points[i].x, points[i].y, points[i].z);
      vertices.push(zeroPoints[i].x, zeroPoints[i].y, zeroPoints[i].z);
    }
    for (let i = 0; i < points.length - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [points, zeroPoints]);
  useEffect(() => () => fillGeom?.dispose(), [fillGeom]);

  // Update draw range without recreating geometry
  useEffect(() => {
    lineGeom.setDrawRange(0, currentIndex + 1);
    // fill has 6 indices per segment, currentIndex segments between currentIndex+1 points
    fillGeom?.setDrawRange(0, Math.max(0, currentIndex * 6));
  }, [lineGeom, fillGeom, currentIndex]);

  const currentPos = currentIndex < points.length ? points[currentIndex] : null;

  return (
    <group>
      <Line3 geometry={lineGeom} color={color} linewidth={2} />

      {fillGeom && (
        <mesh geometry={fillGeom}>
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {currentPos && (
        <mesh position={currentPos}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
    </group>
  );
}

/** Floor grid for depth perception */
function FloorGrid() {
  const geoms = useMemo(() => {
    const result: THREE.BufferGeometry[] = [];
    for (let i = -1.5; i <= 1.5; i += 0.5) {
      result.push(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2, -1.5, i), new THREE.Vector3(2, -1.5, i)]));
      result.push(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i, -1.5, -1.5), new THREE.Vector3(i, -1.5, 1.5)]));
    }
    return result;
  }, []);

  return (
    <group>
      {geoms.map((geom, i) => (
        <Line3 key={i} geometry={geom} color="#888" transparent opacity={0.08} />
      ))}
    </group>
  );
}

/** Main 3D scene content */
function Scene({ data, currentIndex }: AngleRibbon3DProps) {
  const { rollNorm, pitchNorm, zTime, N } = useRibbonGeometry(data!);

  // Build point arrays for each ribbon
  const { rollPts, rollZero, pitchPts, pitchZero, combinedPts } = useMemo(() => {
    const rp: THREE.Vector3[] = [];
    const rz: THREE.Vector3[] = [];
    const pp: THREE.Vector3[] = [];
    const pz: THREE.Vector3[] = [];
    const cp: THREE.Vector3[] = [];

    for (let i = 0; i < N; i++) {
      // Roll ribbon: vertical plane (x=0)
      rp.push(new THREE.Vector3(0, rollNorm[i], zTime[i]));
      rz.push(new THREE.Vector3(0, 0, zTime[i]));

      // Pitch ribbon: horizontal plane (y=0)
      pp.push(new THREE.Vector3(pitchNorm[i], 0, zTime[i]));
      pz.push(new THREE.Vector3(0, 0, zTime[i]));

      // Combined path
      cp.push(new THREE.Vector3(pitchNorm[i], rollNorm[i], zTime[i]));
    }

    return { rollPts: rp, rollZero: rz, pitchPts: pp, pitchZero: pz, combinedPts: cp };
  }, [rollNorm, pitchNorm, zTime, N]);

  // Combined line (purple) — full geometry, drawRange controls visible count
  const combinedGeom = useMemo(() =>
    new THREE.BufferGeometry().setFromPoints(combinedPts),
  [combinedPts]);
  useEffect(() => () => combinedGeom.dispose(), [combinedGeom]);
  useEffect(() => {
    combinedGeom.setDrawRange(0, currentIndex + 1);
  }, [combinedGeom, currentIndex]);

  const combinedPos = currentIndex < combinedPts.length ? combinedPts[currentIndex] : null;

  return (
    <>
      <ambientLight intensity={0.5} />

      <FloorGrid />

      {/* Roll ribbon — red, vertical plane */}
      <Ribbon
        points={rollPts}
        zeroPoints={rollZero}
        color="#E24B4A"
        currentIndex={currentIndex}
      />

      {/* Pitch ribbon — green, horizontal plane */}
      <Ribbon
        points={pitchPts}
        zeroPoints={pitchZero}
        color="#1D9E75"
        currentIndex={currentIndex}
      />

      {/* Combined path — purple */}
      <Line3 geometry={combinedGeom} color="#534AB7" linewidth={1.5} />
      {combinedPos && (
        <mesh position={combinedPos}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color="#534AB7" />
        </mesh>
      )}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
      />
    </>
  );
}

/** Wrapper component with Canvas */
export default function AngleRibbon3D({ data, currentIndex }: AngleRibbon3DProps) {
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
        camera={{ position: [3, 2, 3], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <Scene data={data} currentIndex={currentIndex} />
      </Canvas>
    </div>
  );
}
