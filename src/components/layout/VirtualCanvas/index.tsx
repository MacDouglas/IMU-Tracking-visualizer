// VirtualCanvas — бесконечный канвас с зумом и панорамированием
// Zoom: колёсико мыши (к курсору) или кнопки ± в углу
// Pan: зажать левую кнопку на фоне и тащить
// Панели отмечены [data-panel], их события не перехватываются канвасом

import { useRef, useState, useEffect, useCallback } from 'react';

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;
const WHEEL_STEP = 0.12;

const ctrlBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: '1px solid #ccc',
  borderRadius: 6,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: '1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  flexShrink: 0,
  userSelect: 'none',
};

interface VirtualCanvasProps {
  children: React.ReactNode;
  /** Начальное смещение в px (по умолчанию 32, 32) */
  initialX?: number;
  initialY?: number;
}

export default function VirtualCanvas({
  children,
  initialX = 32,
  initialY = 32,
}: VirtualCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // Состояние трансформации хранится в refs — обновление через direct DOM, без ре-рендера
  const panRef = useRef({ x: initialX, y: initialY });
  const zoomRef = useRef(1);
  const isPanRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Только для UI зум-индикатора и курсора (re-render разрешён)
  const [displayZoom, setDisplayZoom] = useState(100);
  const [isPanning, setIsPanning] = useState(false);

  const applyTransform = useCallback(() => {
    if (innerRef.current) {
      innerRef.current.style.transform =
        `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${zoomRef.current})`;
    }
  }, []);

  // Zoom к точке (cx, cy) в координатах контейнера
  const zoomToPoint = useCallback((cx: number, cy: number, factor: number) => {
    const prev = zoomRef.current;
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * factor));
    if (next === prev) return;
    panRef.current = {
      x: cx - (cx - panRef.current.x) * (next / prev),
      y: cy - (cy - panRef.current.y) * (next / prev),
    };
    zoomRef.current = next;
    applyTransform();
    setDisplayZoom(Math.round(next * 100));
  }, [applyTransform]);

  // Нативный (non-passive) обработчик колёсика — только на фоне канваса
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Если событие внутри панели — пропускаем (позволяем OrbitControls работать)
      if ((e.target as HTMLElement).closest('[data-panel]')) return;
      e.preventDefault();

      const factor = e.deltaY < 0 ? (1 + WHEEL_STEP) : (1 / (1 + WHEEL_STEP));
      const rect = el.getBoundingClientRect();
      zoomToPoint(e.clientX - rect.left, e.clientY - rect.top, factor);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [zoomToPoint]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-panel]')) return;
    e.preventDefault();
    isPanRef.current = true;
    setIsPanning(true);
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanRef.current) return;
    panRef.current = {
      x: panRef.current.x + e.clientX - lastMouseRef.current.x,
      y: panRef.current.y + e.clientY - lastMouseRef.current.y,
    };
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    applyTransform();
  }, [applyTransform]);

  const stopPan = useCallback(() => {
    if (isPanRef.current) {
      isPanRef.current = false;
      setIsPanning(false);
    }
  }, []);

  // Кнопочный зум к центру экрана
  const zoomToCenter = useCallback((factor: number) => {
    const el = containerRef.current;
    const rect = el?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 400;
    const cy = rect ? rect.height / 2 : 300;
    zoomToPoint(cx, cy, factor);
  }, [zoomToPoint]);

  const resetView = useCallback(() => {
    panRef.current = { x: initialX, y: initialY };
    zoomRef.current = 1;
    applyTransform();
    setDisplayZoom(100);
  }, [applyTransform, initialX, initialY]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        cursor: isPanning ? 'grabbing' : 'grab',
        userSelect: 'none',
        background: '#e9e9ed',
        backgroundImage: 'radial-gradient(circle, #c2c2ca 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopPan}
      onMouseLeave={stopPan}
    >
      {/* Трансформируемый слой с панелями */}
      <div
        ref={innerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transformOrigin: '0 0',
          transform: `translate(${initialX}px, ${initialY}px) scale(1)`,
        }}
      >
        {children}
      </div>

      {/* Кнопки зума — правый нижний угол */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'rgba(255,255,255,0.92)',
          border: '1px solid #ddd',
          borderRadius: 8,
          padding: '4px 8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          pointerEvents: 'auto',
          userSelect: 'none',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        <button style={ctrlBtnStyle} onClick={() => zoomToCenter(1 / (1 + WHEEL_STEP * 2))} title="Отдалить">−</button>
        <span style={{
          minWidth: 44,
          textAlign: 'center',
          fontSize: 13,
          color: '#555',
          fontVariantNumeric: 'tabular-nums',
          cursor: 'default',
        }}>
          {displayZoom}%
        </span>
        <button style={ctrlBtnStyle} onClick={() => zoomToCenter(1 + WHEEL_STEP * 2)} title="Приблизить">+</button>
        <div style={{ width: 1, background: '#ddd', height: 18, margin: '0 2px' }} />
        <button
          style={{ ...ctrlBtnStyle, width: 'auto', fontSize: 12, padding: '0 8px' }}
          onClick={resetView}
          title="Сбросить вид (1:1)"
        >
          1:1
        </button>
      </div>
    </div>
  );
}
