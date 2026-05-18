// types/tremor.ts

/**
 * Output of the two-stage tremor analysis pipeline (Gallego et al. 2010).
 *
 * Pipeline:
 *   Stage 1: CDF (θ=0.990) separates voluntary (<2Hz) from tremor
 *   Stage 2: WFLC tracks frequency → Kalman Filter smooths amplitude
 */
export interface TremorAnalysis {
  /** Time array in seconds (same length as all other arrays) */
  t: number[];

  /** Raw gyroscope signal (°/s) — input to the pipeline */
  raw: number[];

  /** Voluntary motion estimate from CDF (°/s) — slow component <2Hz */
  voluntary: number[];

  /** Tremor signal = raw - voluntary (°/s) — fast component >2Hz */
  tremor: number[];

  /** Instantaneous tremor frequency from WFLC (Hz) */
  frequency: number[];

  /** Instantaneous tremor amplitude from Kalman Filter (°/s) */
  amplitude: number[];

  /** Spectrogram data for heatmap visualization */
  spectrogram: SpectrogramData;
}

export interface SpectrogramData {
  /** Time bins (seconds) */
  timeBins: number[];
  /** Frequency bins (Hz) */
  freqBins: number[];
  /** Power values in dB, [freqIndex][timeIndex] */
  power: number[][];
}

/**
 * Parameters for the tremor pipeline.
 * Defaults from Gallego et al. 2010, Table optimized values.
 */
export interface TremorPipelineParams {
  /** CDF damping parameter (default 0.990) */
  cdfTheta: number;
  /** WFLC frequency adaptation gain (default 5e-4) */
  wflcMu0: number;
  /** WFLC amplitude adaptation gain (default 2e-2) */
  wflcMu1: number;
  /** WFLC bias weight (default 1e-2) */
  wflcMuB: number;
  /** WFLC initial frequency guess in Hz (default 8.0) */
  wflcF0: number;
  /** WFLC frequency clamp min Hz (default 2) */
  wflcFMin: number;
  /** WFLC frequency clamp max Hz (default 20) */
  wflcFMax: number;
  /** Kalman measurement noise covariance (default 0.01) */
  kalmanR: number;
  /** Kalman process noise covariance (default 0.001) */
  kalmanQ: number;
  /** Sampling period in seconds (default 0.01 for 100Hz) */
  ts: number;
  /** Spectrogram FFT window size in samples — must be power of 2 (default 256) */
  specWindowSize: number;
  /** Spectrogram FFT overlap in samples (default 246, step=10) */
  specOverlap: number;
}

export const DEFAULT_TREMOR_PARAMS: TremorPipelineParams = {
  cdfTheta: 0.990,
  wflcMu0: 5e-4,
  wflcMu1: 2e-2,
  wflcMuB: 1e-2,
  wflcF0: 8.0,
  wflcFMin: 2,
  wflcFMax: 20,
  kalmanR: 0.01,
  kalmanQ: 0.001,
  ts: 0.01,
  specWindowSize: 256,
  specOverlap: 246,
};
