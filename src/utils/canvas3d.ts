// utils/canvas3d.ts
//
// Shared 3D projection and drawing helpers for Canvas-based 3D panels.
// All v4 3D panels use the same camera model.

export interface Camera {
  yawDeg: number;
  pitchDeg: number;
}

export interface ProjectionContext {
  cx: number;
  cy: number;
  cosY: number;
  sinY: number;
  cosP: number;
  sinP: number;
  scale: number;
  depthDiv: number;
}

export function createProjection(
  width: number,
  height: number,
  camera: Camera,
  scale: number = 120,
  depthDiv: number = 4
): ProjectionContext {
  const yaw = (camera.yawDeg * Math.PI) / 180;
  const pitch = (camera.pitchDeg * Math.PI) / 180;
  return {
    cx: width / 2,
    cy: height / 2 + 20,
    cosY: Math.cos(yaw),
    sinY: Math.sin(yaw),
    cosP: Math.cos(pitch),
    sinP: Math.sin(pitch),
    scale,
    depthDiv,
  };
}

export function project(
  pc: ProjectionContext,
  px: number,
  py: number,
  pz: number
): [number, number] {
  const x1 = px * pc.cosY + pz * pc.sinY;
  const z1 = -px * pc.sinY + pz * pc.cosY;
  const y1 = py * pc.cosP - z1 * pc.sinP;
  const z2 = py * pc.sinP + z1 * pc.cosP;
  const f = z2 / pc.depthDiv + 3.5;
  return [pc.cx + (x1 * pc.scale) / f, pc.cy - (y1 * pc.scale) / f];
}

/** Draw floor grid lines at y=floorY */
export function drawFloorGrid(
  ctx: CanvasRenderingContext2D,
  pc: ProjectionContext,
  floorY: number = -2
): void {
  ctx.strokeStyle = 'rgba(128,128,128,0.05)';
  ctx.lineWidth = 0.5;
  for (let g = -1.5; g <= 1.5; g += 0.75) {
    const a = project(pc, -2, floorY, g);
    const b = project(pc, 2, floorY, g);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
}

/** Draw a gradient-colored trail */
export function drawTrail(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  color: string,
  baseAlpha: number = 0.3
): void {
  const N = points.length;
  for (let i = 1; i < N; i++) {
    const f = i / N;
    const alpha = baseAlpha + (1 - baseAlpha) * f;
    ctx.strokeStyle = color.replace('A)', `${alpha.toFixed(2)})`);
    ctx.lineWidth = 1.5 + f;
    ctx.beginPath();
    ctx.moveTo(points[i - 1][0], points[i - 1][1]);
    ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
  }
}

/** Draw DTW connection lines between two sets of points */
export function drawDtwLinks(
  ctx: CanvasRenderingContext2D,
  path: [number, number][],
  points1: [number, number][],
  points2: [number, number][],
  step: number = 1
): void {
  ctx.strokeStyle = 'rgba(150,150,150,0.18)';
  ctx.lineWidth = 0.7;
  for (let k = 0; k < path.length; k += step) {
    const [i, j] = path[k];
    if (i < points1.length && j < points2.length) {
      ctx.beginPath();
      ctx.moveTo(points1[i][0], points1[i][1]);
      ctx.lineTo(points2[j][0], points2[j][1]);
      ctx.stroke();
    }
  }
}

/** Draw a dot at given screen position */
export function drawDot(
  ctx: CanvasRenderingContext2D,
  pos: [number, number],
  color: string,
  radius: number = 5
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(pos[0], pos[1], radius, 0, Math.PI * 2);
  ctx.fill();
}
