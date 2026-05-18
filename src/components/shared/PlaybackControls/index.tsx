// components/shared/PlaybackControls/index.tsx

import { useState, useEffect, useCallback, useRef } from 'react';

interface PlaybackControlsProps {
  /** Total number of frames */
  frameCount: number;
  /** Current frame index */
  currentIndex: number;
  /** Called when frame changes */
  onIndexChange: (index: number | ((prev: number) => number)) => void;
  /** Playback speed: ms between frames (default 60) */
  intervalMs?: number;
  /** Display time for current frame */
  currentTime?: number;
}

export default function PlaybackControls({
  frameCount,
  currentIndex,
  onIndexChange,
  intervalMs = 60,
  currentTime,
}: PlaybackControlsProps) {
  const [playing, setPlaying] = useState(false);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  const toggle = useCallback(() => {
    setPlaying(prev => {
      if (!prev && currentIndex >= frameCount - 1) {
        onIndexChange(0);
      }
      return !prev;
    });
  }, [currentIndex, frameCount, onIndexChange]);

  useEffect(() => {
    if (!playing) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    const animate = (ts: number) => {
      if (ts - lastTimeRef.current >= intervalMs) {
        lastTimeRef.current = ts;
        onIndexChange(prev => {
          const next = prev + 1;
          if (next >= frameCount) {
            setPlaying(false);
            return frameCount - 1;
          }
          return next;
        });
      }
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [playing, frameCount, intervalMs, onIndexChange]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 0',
    }}>
      <button
        onClick={toggle}
        style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '1px solid #ccc', background: '#fff',
          fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <input
        type="range"
        min={0}
        max={frameCount - 1}
        value={currentIndex}
        onChange={e => onIndexChange(parseInt(e.target.value, 10))}
        style={{ flex: 1 }}
      />
      <span style={{ fontSize: 13, color: '#666', minWidth: 50, textAlign: 'right' }}>
        {currentTime !== undefined ? `${currentTime.toFixed(1)}s` : `${currentIndex}/${frameCount - 1}`}
      </span>
    </div>
  );
}
