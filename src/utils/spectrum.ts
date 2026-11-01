// utils/spectrum.ts — Welch PSD for the TremorSpectrum panel

import FFT from 'fft.js';
import { DT } from './imuProcessing';

export const WELCH_WIN = 256;
export const WELCH_HOP = 128;
const MAX_HZ = 20;

function hann(i: number, N: number): number {
  return 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
}

/** Lower edge of the tremor band: below it is voluntary motion (same split as CDF/WFLC, 2 Hz) */
export const TREMOR_BAND_MIN_HZ = 2;

/**
 * Highest PSD point with freq in [minHz, maxHz]. The global maximum is almost always
 * at 0 Hz (slow voluntary motion), which says nothing about tremor.
 * `atEdge` = the maximum is the first or last bin of the band, i.e. the spectrum just
 * falls (or rises) across the band and has no local peak — no periodic tremor.
 */
export function peakInBand(
  psd: { freq: number; psd: number }[],
  minHz = TREMOR_BAND_MIN_HZ,
  maxHz = MAX_HZ,
): { freq: number; psd: number; atEdge: boolean } | null {
  const band = psd.filter(p => p.freq >= minHz && p.freq <= maxHz);
  if (band.length === 0) return null;
  let k = 0;
  for (let i = 1; i < band.length; i++) if (band[i].psd > band[k].psd) k = i;
  return { ...band[k], atEdge: k === 0 || k === band.length - 1 };
}

/**
 * Welch PSD in dB: Hann window 256, hop 128, fs = 100 Hz, 0–20 Hz.
 * Returns [] when the signal is shorter than one window.
 */
export function welchPsd(signal: ArrayLike<number>): { freq: number; psd: number }[] {
  const N = signal.length;
  if (N < WELCH_WIN) return [];

  const fs = 1 / DT;
  const freqRes = fs / WELCH_WIN;
  const maxBin = Math.min(Math.floor(MAX_HZ / freqRes), WELCH_WIN / 2);

  const fft = new FFT(WELCH_WIN);
  const complexOut = fft.createComplexArray();
  const hannSum = Array.from({ length: WELCH_WIN }, (_, i) => hann(i, WELCH_WIN)).reduce((a, b) => a + b * b, 0);
  const scale = hannSum * WELCH_WIN;

  const accumPower = new Float64Array(maxBin + 1);
  let numWindows = 0;

  for (let start = 0; start + WELCH_WIN <= N; start += WELCH_HOP) {
    const realIn = new Array<number>(WELCH_WIN);
    for (let j = 0; j < WELCH_WIN; j++) {
      realIn[j] = signal[start + j] * hann(j, WELCH_WIN);
    }
    fft.realTransform(complexOut, realIn);
    for (let fi = 0; fi <= maxBin; fi++) {
      const re = complexOut[2 * fi];
      const im = complexOut[2 * fi + 1];
      accumPower[fi] += (re * re + im * im) / scale;
    }
    numWindows++;
  }

  const result: { freq: number; psd: number }[] = [];
  for (let fi = 0; fi <= maxBin; fi++) {
    const avg = accumPower[fi] / numWindows;
    const db = Math.round(10 * Math.log10(avg + 1e-10) * 10) / 10;
    result.push({ freq: Math.round(fi * freqRes * 10) / 10, psd: db });
  }
  return result;
}
