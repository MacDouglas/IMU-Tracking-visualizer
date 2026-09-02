// components/panels/AngleTimeline/index.tsx
//
// 3D-отображение углов Эйлера (Roll, Pitch, Yaw) во времени.
// Стилистика аналогична AngleRibbon3D и TipTrailTimeline3D:
//   — три параллельных «занавески» вдоль оси времени (Z)
//   — каждый угол — линия + прозрачная заливка до нулевой плоскости
//   — Roll (красный) X=-1.6,  Pitch (зелёный) X=0,  Yaw (синий) X=+1.6
//   — OrbitControls, сетка пола, метки времени

import { useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { ImuVisualizationData } from '../../../types/imu';

// ─── Обёртка THREE.Line (избегаем коллизии JSX <line> с SVG) ───────────────

function Line3({
  geometry,
  color,
  linewidth,
  transparent,
  opacity,
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
  const obj = useMemo(() => new THREE.Line(geometry, mat), [geometry, mat]);
  return <primitive object={obj} />;
}

// ─── Типы ───────────────────────────────────────────────────────────────────

interface AngleTimelineProps {
  data?: ImuVisualizationData | null;
  currentIndex?: number;
}

const LANE_X = [-1.6, 0, 1.6] as const; // X-позиции трёх полос
const COLORS = ['#E24B4A', '#1D9E75', '#4A8FE2'] as const; // Roll, Pitch, Yaw
const LABELS = ['Roll', 'Pitch', 'Yaw'] as const;
const FLOOR_Y = -2;

// ─── Геометрия трёх полос ───────────────────────────────────────────────────

function useAngleGeometry(data: ImuVisualizationData) {
  return useMemo(() => {
    const { recording } = data;
    const N = recording.length;
    const tMax = recording.duration;

    // Максимальный абсолютный угол по каждой оси — для нормировки
    const scales = [recording.angleX, recording.angleY, recording.angleZ].map(arr =>
      Math.max(Math.abs(Math.min(...arr)), Math.abs(Math.max(...arr)), 1),
    );

    // Нормированные значения и время
    const angles = [recording.angleX, recording.angleY, recording.angleZ];
    const normPts: THREE.Vector3[][] = [[], [], []];
    const zeroPts: THREE.Vector3[][] = [[], [], []];
    const zTimes: number[] = [];

    for (let i = 0; i < N; i++) {
      const z = (recording.t[i] / tMax) * 3 - 1.5;
      zTimes.push(z);
      for (let lane = 0; lane < 3; lane++) {
        const y = (angles[lane][i] / scales[lane]) * 1.4; // ±1.4 макс
        normPts[lane].push(new THREE.Vector3(LANE_X[lane], y, z));
        zeroPts[lane].push(new THREE.Vector3(LANE_X[lane], 0, z));
      }
    }

    return { normPts, zeroPts, zTimes, N, tMax, scales };
  }, [data]);
}

// ─── Одна «занавеска» ───────────────────────────────────────────────────────

function AngleCurtain({
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
  // Create full geometries once — drawRange controls visible count
  const lineGeom = useMemo(() =>
    new THREE.BufferGeometry().setFromPoints(points),
  [points]);
  useEffect(() => () => lineGeom.dispose(), [lineGeom]);

  const zeroGeom = useMemo(() =>
    new THREE.BufferGeometry().setFromPoints(zeroPoints),
  [zeroPoints]);
  useEffect(() => () => zeroGeom.dispose(), [zeroGeom]);

  const fillGeom = useMemo(() => {
    if (points.length < 2) return null;
    const verts: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < points.length; i++) {
      verts.push(points[i].x, points[i].y, points[i].z);
      verts.push(zeroPoints[i].x, zeroPoints[i].y, zeroPoints[i].z);
    }
    for (let i = 0; i < points.length - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c);
      idx.push(b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [points, zeroPoints]);
  useEffect(() => () => fillGeom?.dispose(), [fillGeom]);

  // Update draw range without recreating geometry
  useEffect(() => {
    lineGeom.setDrawRange(0, currentIndex + 1);
    zeroGeom.setDrawRange(0, currentIndex + 1);
    fillGeom?.setDrawRange(0, Math.max(0, currentIndex * 6));
  }, [lineGeom, zeroGeom, fillGeom, currentIndex]);

  const currentPos = currentIndex < points.length ? points[currentIndex] : null;

  return (
    <group>
      {/* Кривая угла */}
      <Line3 geometry={lineGeom} color={color} linewidth={2} />

      {/* Нулевая линия */}
      <Line3 geometry={zeroGeom} color={color} transparent opacity={0.25} linewidth={1} />

      {/* Заливка */}
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

      {/* Текущая точка */}
      {currentPos && (
        <mesh position={currentPos}>
          <sphereGeometry args={[0.06, 12, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
    </group>
  );
}

// ─── Сетка пола ─────────────────────────────────────────────────────────────

function FloorGrid() {
  const geoms = useMemo(() => {
    const res: THREE.BufferGeometry[] = [];
    // Линии по Z (временная ось)
    for (let x = -2.2; x <= 2.2; x += 0.5) {
      res.push(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, FLOOR_Y, -1.5),
        new THREE.Vector3(x, FLOOR_Y, 1.5),
      ]));
    }
    // Линии по X (пересечение)
    for (let z = -1.5; z <= 1.5; z += 0.5) {
      res.push(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-2.2, FLOOR_Y, z),
        new THREE.Vector3(2.2, FLOOR_Y, z),
      ]));
    }
    return res;
  }, []);

  return (
    <group>
      {geoms.map((g, i) => (
        <Line3 key={i} geometry={g} color="#888" transparent opacity={0.06} />
      ))}
    </group>
  );
}

// ─── Метки времени ──────────────────────────────────────────────────────────

function TimeLabels({ tMax }: { tMax: number }) {
  const labels = [0, 10, 20, 30].filter(s => s <= tMax);
  return (
    <group>
      {labels.map(sec => {
        const z = (sec / tMax) * 3 - 1.5;
        return (
          <Text key={sec} position={[-2.4, FLOOR_Y, z]} fontSize={0.11} color="#888" anchorX="right" anchorY="middle">
            {sec}s
          </Text>
        );
      })}
    </group>
  );
}

// ─── Сцена ──────────────────────────────────────────────────────────────────

// Горизонтальные базовые линии для каждой полосы (стабильная геометрия)
const LANE_BASE_GEOMS = LANE_X.map(x =>
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x, 0, -1.5),
    new THREE.Vector3(x, 0, 1.5),
  ]),
);

function Scene({ data, currentIndex }: Required<AngleTimelineProps> & { data: ImuVisualizationData }) {
  const { normPts, zeroPts, tMax } = useAngleGeometry(data);

  return (
    <>
      <ambientLight intensity={0.6} />
      <FloorGrid />
      <TimeLabels tMax={tMax} />

      {/* Три полосы углов */}
      {([0, 1, 2] as const).map(lane => (
        <group key={lane}>
          {/* Метка оси */}
          <Text
            position={[LANE_X[lane], 1.65, -1.5]}
            fontSize={0.14}
            color={COLORS[lane]}
            anchorX="center"
            anchorY="bottom"
          >
            {LABELS[lane]}
          </Text>

          {/* Нулевая базовая линия полосы */}
          <Line3
            geometry={LANE_BASE_GEOMS[lane]}
            color="#aaa"
            transparent
            opacity={0.15}
          />

          <AngleCurtain
            points={normPts[lane]}
            zeroPoints={zeroPts[lane]}
            color={COLORS[lane]}
            currentIndex={currentIndex}
          />
        </group>
      ))}

      <OrbitControls enablePan enableZoom />
    </>
  );
}

// ─── Компонент-обёртка ───────────────────────────────────────────────────────

export default function AngleTimeline({ data, currentIndex = 0 }: AngleTimelineProps) {
  if (!data) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#aaa', fontSize: 13,
      }}>
        Загрузите TSV файл
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [3.5, 2.2, 4.5], fov: 50 }} style={{ background: 'transparent' }}>
        <Scene data={data} currentIndex={currentIndex} />
      </Canvas>
    </div>
  );
}
