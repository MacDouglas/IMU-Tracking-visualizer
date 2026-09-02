// utils/tremorPipeline.ts
//
// Two-stage algorithm for real-time tremor parameter estimation.
// Based on: Gallego et al. "Real-Time Estimation of Pathological Tremor
// Parameters from Gyroscope Data", Sensors 2010, 10, 2129-2149.
//
// Stage 1: Critically Damped Filter (CDF) separates voluntary (<2Hz) from tremor
// Stage 2: WFLC tracks tremor frequency → Kalman Filter estimates amplitude
//
// Input: raw gyroscope axis data (°/s) at 100Hz
// Output: TremorAnalysis with voluntary, tremor, frequency, amplitude, spectrogram

// @ts-expect-error — fft.js has no bundled TypeScript types
import FFT from 'fft.js';

import {
  type TremorAnalysis,
  type SpectrogramData,
  type TremorPipelineParams,
  DEFAULT_TREMOR_PARAMS,
} from '../types/tremor';

// ─────────────────────────────────────────────────────────────
// Stage 1: Critically Damped Filter
// ─────────────────────────────────────────────────────────────
//
// g-h filter with parameters:
//   g = 1 - θ²
//   h = (1 - θ)²
//
// Tracks voluntary movement modelled as first-order process.
// θ=0.990 → g≈0.0199, h≈0.0001 → very smooth, tracks only <~2Hz
//
// Update equations:
//   x_est = x_pred + g * (measurement - x_pred)
//   v_est = v_pred + (h / Ts) * (measurement - x_pred)
//   x_pred_next = x_est + Ts * v_est

function criticallyDampedFilter(
  signal: number[],
  theta: number,
  ts: number
): number[] {
  const N = signal.length;
  const g = 1.0 - theta * theta;
  const h = (1.0 - theta) * (1.0 - theta);
  const hOverTs = h / ts;

  const output = new Array<number>(N);
  let xEst = signal[0];
  let vEst = 0;

  for (let k = 0; k < N; k++) {
    // Predict
    const xPred = xEst + ts * vEst;
    const vPred = vEst;

    // Update
    const residual = signal[k] - xPred;
    xEst = xPred + g * residual;
    vEst = vPred + hOverTs * residual;

    output[k] = xEst;
  }

  return output;
}

// ─────────────────────────────────────────────────────────────
// Stage 2a: Weighted Frequency Fourier Linear Combiner (WFLC)
// ─────────────────────────────────────────────────────────────
//
// Adaptive sinusoidal model with LMS recursion.
// M=1 harmonic: models tremor as A·sin(ωt + φ)
//
// Adapts frequency (ω), amplitude (weights w), and phase.
//   ω[k+1] = ω[k] + 2·μ0·ε·(w_sin·cos - w_cos·sin)
//   W[k+1] = W[k] + 2·μ1·ε·X
//
// Output: instantaneous frequency (Hz) and raw amplitude estimate

interface WflcOutput {
  frequency: number[];
  amplitude: number[];
}

function wflc(
  tremor: number[],
  params: TremorPipelineParams
): WflcOutput {
  const N = tremor.length;
  const { wflcMu0: mu0, wflcMu1: mu1, wflcMuB: muB, wflcF0, wflcFMin, wflcFMax, ts } = params;

  const omega = new Array<number>(N).fill(0);
  omega[0] = 2 * Math.PI * wflcF0;

  let wSin = 0; // weight for sin component
  let wCos = 0; // weight for cos component
  let omegaSum = 0;

  const frequency = new Array<number>(N).fill(0);
  const amplitude = new Array<number>(N).fill(0);

  const omegaMin = 2 * Math.PI * wflcFMin;
  const omegaMax = 2 * Math.PI * wflcFMax;

  for (let k = 1; k < N; k++) {
    omegaSum += omega[k - 1];

    // Reference signals (Fourier basis, M=1)
    const phase = omegaSum * ts;
    const xSin = Math.sin(phase);
    const xCos = Math.cos(phase);

    // Model output + bias
    const yHat = wSin * xSin + wCos * xCos + muB;

    // Error
    const eps = tremor[k] - yHat;

    // Frequency adaptation (Eq. 16 from paper)
    const dOmega = wSin * xCos - wCos * xSin;
    omega[k] = omega[k - 1] + 2 * mu0 * eps * dOmega;

    // Clamp to reasonable range
    if (omega[k] < omegaMin) omega[k] = omegaMin;
    if (omega[k] > omegaMax) omega[k] = omegaMax;

    // Weight adaptation (Eq. 17 from paper)
    wSin += 2 * mu1 * eps * xSin;
    wCos += 2 * mu1 * eps * xCos;

    // Store results
    frequency[k] = omega[k] / (2 * Math.PI);
    amplitude[k] = Math.sqrt(wSin * wSin + wCos * wCos);
  }

  frequency[0] = wflcF0;

  return { frequency, amplitude };
}

// ─────────────────────────────────────────────────────────────
// Stage 2b: Kalman Filter for amplitude smoothing
// ─────────────────────────────────────────────────────────────
//
// State: tremor amplitude (scalar)
// Model: amplitude is approximately constant between samples
// Measurement: WFLC amplitude estimate (noisy)
//
// Kalman gain adapts automatically — faster response than
// fixed-gain WFLC during amplitude transients.

function kalmanAmplitude(
  wflcAmplitude: number[],
  R: number,
  Q: number
): number[] {
  const N = wflcAmplitude.length;
  const output = new Array<number>(N);

  let x = 0;   // state estimate
  let P = 1.0; // error covariance

  for (let k = 0; k < N; k++) {
    // Predict (constant model)
    const xPred = x;
    const pPred = P + Q;

    // Update
    const K = pPred / (pPred + R);
    x = xPred + K * (wflcAmplitude[k] - xPred);
    P = (1 - K) * pPred;

    output[k] = x;
  }

  return output;
}

// ─────────────────────────────────────────────────────────────
// Spectrogram (sliding window FFT)
// ─────────────────────────────────────────────────────────────
//
// Computes short-time Fourier transform of the tremor signal.
// Uses Hann window, outputs power in dB.
//
// Note: for production, consider using a Web Worker or
// computing this on the C# backend for large files.

function computeSpectrogram(
  signal: number[],
  sampleRate: number,
  windowSize: number,
  overlap: number,
  maxFreqHz: number = 20
): SpectrogramData {
  const step = windowSize - overlap;
  const numWindows = Math.floor((signal.length - windowSize) / step) + 1;

  if (numWindows <= 0) {
    return { timeBins: [], freqBins: [], power: [] };
  }

  // Hann window
  const hann = new Float64Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
  }

  // windowSize must be a power of 2 for fft.js
  const fftSize = windowSize;
  const freqRes = sampleRate / fftSize;
  const maxBin = Math.min(
    Math.ceil(maxFreqHz / freqRes),
    Math.floor(fftSize / 2)
  );

  const freqBins: number[] = [];
  for (let i = 0; i <= maxBin; i++) {
    freqBins.push(Math.round(i * freqRes * 10) / 10);
  }

  const timeBins: number[] = [];
  const power: number[][] = [];
  for (let fi = 0; fi < freqBins.length; fi++) {
    power.push([]);
  }

  const fft = new FFT(fftSize);
  const complexOut = fft.createComplexArray();
  const realIn = new Array<number>(fftSize).fill(0);
  const scale = fftSize * fftSize;

  for (let w = 0; w < numWindows; w++) {
    const start = w * step;
    const centerTime = (start + windowSize / 2) / sampleRate;
    timeBins.push(Math.round(centerTime * 10) / 10);

    for (let i = 0; i < windowSize; i++) {
      realIn[i] = signal[start + i] * hann[i];
    }

    fft.realTransform(complexOut, realIn);

    for (let fi = 0; fi <= maxBin; fi++) {
      const re = complexOut[2 * fi];
      const im = complexOut[2 * fi + 1];
      const db = 10 * Math.log10((re * re + im * im) / scale + 1e-10);
      power[fi].push(Math.round(db * 10) / 10);
    }
  }

  return { timeBins, freqBins, power };
}

// ─────────────────────────────────────────────────────────────
// Main pipeline: combines all stages
// ─────────────────────────────────────────────────────────────

/**
 * Run the full two-stage tremor analysis pipeline.
 *
 * @param t - Time array in seconds
 * @param gyroAxis - Single gyroscope axis data in °/s (use the axis
 *                   aligned with the primary wrist rotation, typically X)
 * @param params - Pipeline parameters (use DEFAULT_TREMOR_PARAMS)
 * @returns TremorAnalysis with all computed signals
 *
 * Processing steps:
 * 1. CDF (θ=0.990) extracts voluntary motion estimate
 * 2. Subtract voluntary from raw → tremor signal
 * 3. WFLC tracks instantaneous tremor frequency
 * 4. Kalman Filter smooths tremor amplitude
 * 5. Sliding-window FFT computes spectrogram
 */
export function runTremorPipeline(
  t: number[],
  gyroAxis: number[],
  params: TremorPipelineParams = DEFAULT_TREMOR_PARAMS
): TremorAnalysis {
  const N = t.length;

  // Stage 1: CDF → voluntary motion
  const voluntary = criticallyDampedFilter(gyroAxis, params.cdfTheta, params.ts);

  // Tremor = raw - voluntary
  const tremor = new Array<number>(N);
  for (let i = 0; i < N; i++) {
    tremor[i] = gyroAxis[i] - voluntary[i];
  }

  // Stage 2: WFLC → frequency + raw amplitude
  const { frequency, amplitude: wflcAmp } = wflc(tremor, params);

  // Stage 2b: Kalman → smoothed amplitude
  const amplitude = kalmanAmplitude(wflcAmp, params.kalmanR, params.kalmanQ);

  // Spectrogram
  const sampleRate = Math.round(1 / params.ts);
  const spectrogram = computeSpectrogram(
    tremor,
    sampleRate,
    params.specWindowSize,
    params.specOverlap
  );

  return {
    t,
    raw: gyroAxis,
    voluntary,
    tremor,
    frequency,
    amplitude,
    spectrogram,
  };
}

/**
 * Downsample TremorAnalysis for visualization.
 * Keeps every Nth point from time-series arrays.
 * Spectrogram is kept as-is (already sparse).
 */
export function downsampleTremor(
  analysis: TremorAnalysis,
  targetPoints: number = 300
): TremorAnalysis {
  const N = analysis.t.length;
  const step = Math.max(1, Math.floor(N / targetPoints));
  const idx: number[] = [];
  for (let i = 0; i < N; i += step) {
    idx.push(i);
    if (idx.length >= targetPoints) break;
  }

  const pick = (arr: number[]) => idx.map(i => arr[i]);

  return {
    t: pick(analysis.t),
    raw: pick(analysis.raw),
    voluntary: pick(analysis.voluntary),
    tremor: pick(analysis.tremor),
    frequency: pick(analysis.frequency),
    amplitude: pick(analysis.amplitude),
    spectrogram: analysis.spectrogram, // already compact
  };
}
