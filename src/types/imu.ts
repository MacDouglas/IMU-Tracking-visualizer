// types/imu.ts

/** Raw row from WitMotion TSV file */
export interface ImuRawRow {
  time: string;
  accX: number;
  accY: number;
  accZ: number;
  gyroX: number;
  gyroY: number;
  gyroZ: number;
  angleX: number;
  angleY: number;
  angleZ: number;
  q0: number;
  q1: number;
  q2: number;
  q3: number;
}

/** Processed IMU recording — all arrays same length */
export interface ImuRecording {
  /** Relative time in seconds from first sample */
  t: number[];
  /** Euler angles in degrees */
  angleX: number[];
  angleY: number[];
  angleZ: number[];
  /** Quaternion components (unit quaternion from firmware fusion) */
  q0: number[];
  q1: number[];
  q2: number[];
  q3: number[];
  /** Gyroscope in °/s */
  gyroX: number[];
  gyroY: number[];
  gyroZ: number[];
  /** Accelerometer in g */
  accX: number[];
  accY: number[];
  accZ: number[];
  /** Sample count */
  length: number;
  /** Recording duration in seconds */
  duration: number;
  /** Effective sample rate in Hz */
  sampleRate: number;
}

/** Precomputed derived data for visualizations */
export interface ImuDerived {
  /** Gyroscope magnitude √(gx²+gy²+gz²) in °/s */
  gyroMag: number[];
  /** Horizontal acceleration √(ax²+ay²) in g */
  accHoriz: number[];
  /** Tip positions from quaternion rotation of [0,0,1] */
  tipX: number[];
  tipY: number[];
  tipZ: number[];
}

/** Downsampled data ready for rendering */
export interface ImuVisualizationData {
  recording: ImuRecording;
  derived: ImuDerived;
  /** Indices into original recording used for this visualization */
  indices: number[];
}
