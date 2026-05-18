// components/panels/OrientationDtw3D
//
// v4.7: Two 3D paths in Roll × Pitch × Time space + DTW connection lines.
// Interactive: OrbitControls — mouse rotate, scroll zoom, right-click pan.
// Tip: view from side = amplitude diff, from top = shape diff, from front = phase shift.

import { useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { DtwComparisonData } from '../../../types/dtw';

const ROLL_SCALE = 110;
const PITCH_SCALE = 70;

function Line3({
  geometry, color, linewidth = 1.5, transparent = false, opacity = 1,
}: {
  geometry: THREE.BufferGeometry;
  color?: string | number;
  linewidth?: number;
  transparent?: boolean;
  opacity?: number;
}) {
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color, linewidth, transparent, opacity }),
    [color, linewidth, transparent, opacity],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const line = useMemo(() => new THREE.Line(geometry, mat), [geometry, mat]);
  return <primitive object={line} />;
}

function FloorGrid() {
  const geoms = useMemo(() => {
    const result: THREE.BufferGeometry[] = [];
    for (let i = -1.5; i <= 1.5; i += 0.5) {
      result.push(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-2, -2, i), new THREE.Vector3(2, -2, i),
      ]));
      result.push(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(i, -2, -1.5), new THREE.Vector3(i, -2, 1.5),
      ]));
    }
    return result;
  }, []);
  return (
    <group>
      {geoms.map((geom, i) => (
        <Line3 key={i} geometry={geom} color="#888" transparent opacity={0.06} />
      ))}
    </group>
  );
}

function DtwLinks({ path, pts1, pts2 }: {
  path: [number, number][];
  pts1: THREE.Vector3[];
  pts2: THREE.Vector3[];
}) {
  const obj = useMemo(() => {
    const positions: number[] = [];
    const step = Math.max(1, Math.floor(path.length / 80));
    for (let k = 0; k < path.length; k += step) {
      const [i, j] = path[k];
      if (i < pts1.length && j < pts2.length) {
        const a = pts1[i], b = pts2[j];
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: '#aaa', transparent: true, opacity: 0.2 });
    return new THREE.LineSegments(geom, mat);
  }, [path, pts1, pts2]);
  useEffect(() => () => { obj.geometry.dispose(); (obj.material as THREE.Material).dispose(); }, [obj]);
  return <primitive object={obj} />;
}

function Scene({ data }: { data: DtwComparisonData }) {
  const { rec1, rec2, dtwEuler } = data;
  const N = rec1.tn.length;

  const { pts1, pts2 } = useMemo(() => {
    const p1: THREE.Vector3[] = [];
    const p2: THREE.Vector3[] = [];
    for (let i = 0; i < N; i++) {
      p1.push(new THREE.Vector3(
        (rec1.pitch[i] / PITCH_SCALE) * 1.5,
        (rec1.roll[i]  / ROLL_SCALE)  * 2,
        (i / (N - 1)) * 3 - 1.5,
      ));
      p2.push(new THREE.Vector3(
        (rec2.pitch[i] / PITCH_SCALE) * 1.5,
        (rec2.roll[i]  / ROLL_SCALE)  * 2,
        (i / (N - 1)) * 3 - 1.5,
      ));
    }
    return { pts1: p1, pts2: p2 };
  }, [rec1, rec2, N]);

  const geom1 = useMemo(() => new THREE.BufferGeometry().setFromPoints(pts1), [pts1]);
  const geom2 = useMemo(() => new THREE.BufferGeometry().setFromPoints(pts2), [pts2]);
  useEffect(() => () => geom1.dispose(), [geom1]);
  useEffect(() => () => geom2.dispose(), [geom2]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <FloorGrid />
      <DtwLinks path={dtwEuler.path} pts1={pts1} pts2={pts2} />
      <Line3 geometry={geom1} color="#E24B4A" linewidth={2} />
      <Line3 geometry={geom2} color="#378ADD" linewidth={2} />
      <mesh position={pts1[0]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color="#E24B4A" />
      </mesh>
      <mesh position={pts2[0]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color="#378ADD" />
      </mesh>
      <OrbitControls enablePan enableZoom />
    </>
  );
}

export default function OrientationDtw3D({ data }: { data: DtwComparisonData }) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [3, 2.5, 3.5], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <Scene data={data} />
      </Canvas>
    </div>
  );
}
