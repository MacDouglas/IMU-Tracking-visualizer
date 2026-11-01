// types/imu.ts

/** Processed IMU recording — all arrays same length */
export interface ImuRecording {
  /** Relative time in seconds from first sample */
  t: number[];
  /** Euler angles in degrees */
  angleX: number[];
  angleY: number[];
  angleZ: number[];
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
  /** Horizontal acceleration √(ax²+ay²) in g — raw sensor axes, valid only for a horizontal sensor */
  accHoriz: number[];
  /** Horizontal motion acceleration in room axes, gravity and bias removed, g (v5.1). Null in Displacement mode */
  accMotionHoriz: number[] | null;
  /** Tip of [0,0,1.8] rotated by R from Euler angles (3rd column of R × 1.8) */
  tipX: number[];
  tipY: number[];
  tipZ: number[];
  /** Angle rates in °/s: derivative at full 100 Hz of unwrapped AngleX/Y/Z, then sampled */
  rateX: number[];
  rateY: number[];
  rateZ: number[];
}

/** Trajectory (v5.1 computeTrajectory), mm relative to start, sampled at `indices` */
export interface VizTrajectory {
  /** Total = translation + rotation */
  trajX: number[]; trajY: number[]; trajZ: number[];
  /** Sensor rotation around the rotation centre (lever arm) */
  rotX: number[]; rotY: number[]; rotZ: number[];
  /** Translation of the rotation centre (ZUPT) */
  baseX: number[]; baseY: number[]; baseZ: number[];
  /** 1 = stationary (velocity zeroed), 0 = moving */
  still: number[];
  /** Lever arm, m, sensor axes */
  leverM: [number, number, number];
}

/** Downsampled data ready for rendering */
export interface ImuVisualizationData {
  recording: ImuRecording;
  derived: ImuDerived;
  /** Null for Displacement-mode or too-short recordings */
  trajectory: VizTrajectory | null;
  /** Indices into original recording used for this visualization */
  indices: number[];
}
