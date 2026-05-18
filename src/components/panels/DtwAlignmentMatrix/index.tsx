// components/panels/DtwAlignmentMatrix
//
// v4_3: DTW warping path on a 2D matrix.

import { useRef, useEffect } from 'react';
import type { DtwComparisonData } from '../../../types/dtw';

interface Props {
  data: DtwComparisonData;
  width?: number;
  height?: number;
}

export default function DtwAlignmentMatrix({ data, width = 500, height = 500 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { dtwEuler, rec1, rec2 } = data;
  const N1 = rec1.roll.length;
  const N2 = rec2.roll.length;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const pad = 50;
    const pw = width - pad * 2;
    const ph = height - pad * 2;

    ctx.clearRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 10; i++) {
      const x = pad + (pw * i) / 10;
      const y = pad + (ph * i) / 10;
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad + ph); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + pw, y); ctx.stroke();
    }

    // Diagonal reference (perfect sync)
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, pad + ph);
    ctx.lineTo(pad + pw, pad);
    ctx.stroke();
    ctx.setLineDash([]);

    // DTW path
    ctx.strokeStyle = '#D4A017';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let k = 0; k < dtwEuler.path.length; k++) {
      const [i, j] = dtwEuler.path[k];
      const x = pad + (i / (N1 - 1)) * pw;
      const y = pad + ph - (j / (N2 - 1)) * ph;
      k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Start dot
    ctx.fillStyle = '#1D9E75';
    ctx.beginPath();
    const [si, sj] = dtwEuler.path[0];
    ctx.arc(pad + (si / (N1 - 1)) * pw, pad + ph - (sj / (N2 - 1)) * ph, 5, 0, Math.PI * 2);
    ctx.fill();

    // End dot
    ctx.fillStyle = '#534AB7';
    ctx.beginPath();
    const [ei, ej] = dtwEuler.path[dtwEuler.path.length - 1];
    ctx.arc(pad + (ei / (N1 - 1)) * pw, pad + ph - (ej / (N2 - 1)) * ph, 5, 0, Math.PI * 2);
    ctx.fill();

    // Axis labels
    ctx.fillStyle = '#666';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${rec1.label} → время`, width / 2, height - 6);

    ctx.save();
    ctx.translate(12, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${rec2.label} → время`, 0, 0);
    ctx.restore();

    // Time ticks
    ctx.font = '10px system-ui';
    ctx.fillStyle = '#999';
    for (let i = 0; i <= 5; i++) {
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(rec1.duration * i / 5)}s`, pad + (pw * i) / 5, pad + ph + 16);
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(rec2.duration * i / 5)}s`, pad - 6, pad + ph - (ph * i) / 5 + 3);
    }
  }, [data, width, height, N1, N2, dtwEuler, rec1, rec2]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: '100%', maxWidth: width, display: 'block' }}
    />
  );
}
