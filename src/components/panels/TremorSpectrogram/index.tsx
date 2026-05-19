// components/panels/TremorSpectrogram/index.tsx
//
// v3_4: Spectrogram heatmap (time × frequency × power)
//
// Input: TremorAnalysis.spectrogram
// Data used: timeBins, freqBins, power[][] (dB)
// Processing: none (FFT done in pipeline)
// Rendering: HTML Canvas with Inferno colormap
//   - X axis: time (seconds)
//   - Y axis: frequency (Hz), 0 at bottom
//   - Color: power spectral density in dB
//
// Interpretation:
//   - Horizontal bright band at 8-12 Hz = physiological tremor
//   - Bright spots at 3-7 Hz during rest = pathological tremor
//   - Bright low-frequency spots during movement = normal voluntary motion residual

import { useRef, useEffect, useMemo } from 'react';
import type { SpectrogramData } from '../../../types/tremor';

interface Props {
  spectrogram: SpectrogramData;
  width?: number;
  height?: number;
}

/**
 * Inferno-like colormap: dark purple → red → orange → yellow
 * Input t in [0, 1], output [r, g, b] in [0, 255]
 */
function inferno(t: number): [number, number, number] {
  const clamp = Math.max(0, Math.min(1, t));
  let r: number, g: number, b: number;

  if (clamp < 0.25) {
    const u = clamp * 4;
    r = 13 + u * (114 - 13);
    g = 8 + u * (1 - 8);
    b = 135 + u * (168 - 135);
  } else if (clamp < 0.5) {
    const u = (clamp - 0.25) * 4;
    r = 114 + u * (189 - 114);
    g = 1 + u * (55 - 1);
    b = 168 + u * (134 - 168);
  } else if (clamp < 0.75) {
    const u = (clamp - 0.5) * 4;
    r = 189 + u * (237 - 189);
    g = 55 + u * (121 - 55);
    b = 134 + u * (83 - 134);
  } else {
    const u = (clamp - 0.75) * 4;
    r = 237 + u * (253 - 237);
    g = 121 + u * (202 - 121);
    b = 83 + u * (38 - 83);
  }

  return [Math.round(r), Math.round(g), Math.round(b)];
}

export default function TremorSpectrogram({
  spectrogram,
  width = 640,
  height = 260,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { timeBins, freqBins, power } = spectrogram;
  const nT = timeBins.length;
  const nF = freqBins.length;

  // Find global min/max for normalization
  const { vmin, vmax } = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (let fi = 0; fi < nF; fi++) {
      for (let ti = 0; ti < nT; ti++) {
        const v = power[fi]?.[ti] ?? -40;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    return { vmin: min, vmax: max };
  }, [power, nF, nT]);

  // Draw heatmap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nT === 0 || nF === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellW = width / nT;
    const cellH = height / nF;
    const range = vmax - vmin || 1;

    for (let fi = 0; fi < nF; fi++) {
      for (let ti = 0; ti < nT; ti++) {
        const v = (power[fi]?.[ti] ?? vmin);
        const norm = (v - vmin) / range;
        const [r, g, b] = inferno(norm);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        // Flip Y so 0 Hz is at bottom
        ctx.fillRect(
          ti * cellW,
          (nF - 1 - fi) * cellH,
          cellW + 1,
          cellH + 1
        );
      }
    }

    // Y-axis labels (frequency)
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    for (let fi = 0; fi < nF; fi += Math.max(1, Math.floor(nF / 8))) {
      const y = (nF - 1 - fi) * cellH + cellH / 2 + 3;
      ctx.fillText(`${freqBins[fi]} Hz`, 42, y);
    }

    // X-axis labels (time)
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    const timeStep = Math.max(1, Math.floor(nT / 6));
    for (let ti = 0; ti < nT; ti += timeStep) {
      const x = ti * cellW + cellW / 2;
      ctx.fillText(`${timeBins[ti]}s`, x, height - 4);
    }
  }, [spectrogram, width, height, vmin, vmax, nT, nF]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '4px 8px', fontSize: 12, color: '#888' }}>
        FFT (окно {spectrogram.timeBins.length > 0 ? 'Welch' : '—'})
        &nbsp;|&nbsp; 0–{freqBins[nF - 1] ?? 20} Hz
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            width: '100%',
            maxWidth: width,
            aspectRatio: `${width} / ${height}`,
            display: 'block',
          }}
        />
      </div>

      {/* Colorbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 8px',
      }}>
        <div style={{
          width: 160, height: 10, borderRadius: 3,
          background: 'linear-gradient(to right, #0d0887, #7201a8, #bd3786, #ed7953, #fdca26)',
        }} />
        <span style={{ fontSize: 11, color: '#888' }}>
          Мощность (dB): {vmin.toFixed(0)} → {vmax.toFixed(0)}
        </span>
      </div>
    </div>
  );
}
