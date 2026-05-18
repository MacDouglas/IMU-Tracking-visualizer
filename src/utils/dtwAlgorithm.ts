// utils/dtwAlgorithm.ts
//
// Dynamic Time Warping for comparing two 2D trajectories.
// Complexity: O(N×M) time and space.
// For N=M=150 (downsampled): 22500 operations — instant.

import type { DtwResult } from '../types/dtw';

/**
 * Compute DTW between two 2D sequences.
 *
 * @param seq1x - X values of sequence 1
 * @param seq1y - Y values of sequence 1
 * @param seq2x - X values of sequence 2
 * @param seq2y - Y values of sequence 2
 * @returns DtwResult with distance, normalized distance, and warping path
 *
 * The warping path is an array of [i, j] pairs showing which point
 * of sequence 1 is aligned with which point of sequence 2.
 * Diagonal steps = both advance (synchronous).
 * Horizontal = seq1 advances, seq2 waits.
 * Vertical = seq2 advances, seq1 waits.
 */
export function computeDtw2D(
  seq1x: number[],
  seq1y: number[],
  seq2x: number[],
  seq2y: number[]
): DtwResult {
  const n = seq1x.length;
  const m = seq2x.length;

  // Cost matrix (n+1) × (m+1)
  const cost: number[][] = [];
  for (let i = 0; i <= n; i++) {
    cost[i] = new Array(m + 1).fill(Infinity);
  }
  cost[0][0] = 0;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const dx = seq1x[i - 1] - seq2x[j - 1];
      const dy = seq1y[i - 1] - seq2y[j - 1];
      const d = Math.sqrt(dx * dx + dy * dy);
      cost[i][j] = d + Math.min(
        cost[i - 1][j - 1], // diagonal — both advance
        cost[i - 1][j],     // horizontal — seq1 advances
        cost[i][j - 1]      // vertical — seq2 advances
      );
    }
  }

  // Backtrack
  const path: [number, number][] = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    path.push([i - 1, j - 1]);
    const diag = cost[i - 1][j - 1];
    const left = cost[i - 1][j];
    const down = cost[i][j - 1];
    if (diag <= left && diag <= down) {
      i--; j--;
    } else if (left <= down) {
      i--;
    } else {
      j--;
    }
  }
  path.reverse();

  const distance = cost[n][m];
  return {
    distance: Math.round(distance * 10) / 10,
    normalized: Math.round((distance / path.length) * 100) / 100,
    path,
  };
}
