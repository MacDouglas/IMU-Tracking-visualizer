// imuProcessing.ts — эталонная обработка записей WitMotion WT9011DCL-BT50 (v5.1, согласовано с фронтендом 29e9d77).
// Тремор здесь НЕ реализуется: источник истины — src/utils/tremorPipeline.ts фронтенда.
// Без зависимостей. Все массивы — обычные number[] / Float64Array, единицы указаны в именах.

export const G = 9.80665;          // м/с², 1 g
export const DT = 0.01;            // с, шаг дискретизации (Return rate 100 Гц)

// ---------------------------------------------------------------- 1. Парсинг

export interface ImuRecord {
  n: number;
  t: Float64Array;                 // с, t[i] = i·DT (метки файла не используются: пакеты BLE)
  acc: Float64Array[];             // [ax, ay, az], g, оси датчика
  gyr: Float64Array[];             // [wx, wy, wz], °/с
  ang: Float64Array[];             // [roll, pitch, yaw] = AngleX/Y/Z, °
  quat: Float64Array[];            // [q0..q3], обновляется ~1,5 Гц — только для справки
  mag: Float64Array[];             // [hx, hy, hz], мкТл, ~1,5 Гц
  battery: number;                 // %, последнее значение
  displacementMode: boolean;       // true → acc/gyr — заглушки, траектория невозможна
}

// Колонки читаются ПО НОМЕРУ: в заголовке две "SpeedY" и битая кодировка "°".
const COL = { acc: [2, 3, 4], gyr: [5, 6, 7], ang: [8, 9, 10], mag: [11, 12, 13], quat: [20, 21, 22, 23], battery: 26 };

export function parseTsv(text: string): ImuRecord {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const rows = lines.slice(1).map(l => l.split('\t'));
  const n = rows.length;
  const num = (s: string | undefined) => (s === undefined || s === 'null' || s === '') ? NaN : Number(s);
  const pick = (idx: number[]) => idx.map(c => Float64Array.from(rows, r => num(r[c])));
  const acc = pick(COL.acc), gyr = pick(COL.gyr), ang = pick(COL.ang);
  const constant = (cols: Float64Array[]) => cols.every(c => c.every(v => v === c[0]));
  return {
    n,
    t: Float64Array.from({ length: n }, (_, i) => i * DT),
    acc, gyr, ang,
    quat: pick(COL.quat), mag: pick(COL.mag),
    battery: num(rows[n - 1]?.[COL.battery]),
    displacementMode: constant(acc) && constant(gyr),
  };
}

// ---------------------------------------------------------------- 2. Ориентация

// R = Rz(yaw)·Ry(pitch)·Rx(roll), хранится построчно (9 чисел на отсчёт). R переводит вектор из осей датчика в оси комнаты (Z вверх).
export function rotationsFromEuler(ang: Float64Array[]): Float64Array {
  const n = ang[0].length, R = new Float64Array(9 * n), d = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const r = ang[0][i] * d, p = ang[1][i] * d, y = ang[2][i] * d;
    const cr = Math.cos(r), sr = Math.sin(r), cp = Math.cos(p), sp = Math.sin(p), cy = Math.cos(y), sy = Math.sin(y);
    R.set([cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr,
           sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr,
           -sp,     cp * sr,                cp * cr], 9 * i);
  }
  return R;
}

const mulRv = (R: Float64Array, i: number, x: number, y: number, z: number): [number, number, number] => {
  const o = 9 * i;
  return [R[o] * x + R[o + 1] * y + R[o + 2] * z, R[o + 3] * x + R[o + 4] * y + R[o + 5] * z, R[o + 6] * x + R[o + 7] * y + R[o + 8] * z];
};

// ---------------------------------------------------------------- 3. Ускорение движения в осях комнаты

// a_m = R·a_изм − (0,0,1), минус среднее по первой секунде покоя, в м/с².
export function motionAcc(acc: Float64Array[], R: Float64Array, restSamples = 100): Float64Array[] {
  const n = acc[0].length, out = [new Float64Array(n), new Float64Array(n), new Float64Array(n)];
  for (let i = 0; i < n; i++) {
    const w = mulRv(R, i, acc[0][i], acc[1][i], acc[2][i]);
    out[0][i] = w[0]; out[1][i] = w[1]; out[2][i] = w[2] - 1;
  }
  const m = Math.min(restSamples, n);
  for (let k = 0; k < 3; k++) {
    let s = 0; for (let i = 0; i < m; i++) s += out[k][i];
    const bias = s / m;
    for (let i = 0; i < n; i++) out[k][i] = (out[k][i] - bias) * G;
  }
  return out;
}

// ---------------------------------------------------------------- 4. Вторая производная (Савицкий–Голей, как scipy mode='interp')

function solve(A: number[][], b: number[]): number[] {              // Гаусс с выбором ведущего, малые системы
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}

// Коэффициенты, которые дают 2-ю производную полинома степени `poly`, подогнанного по окну `win`, в точке окна `pos`.
function sgDeriv2Coeffs(win: number, poly: number, pos: number, dt: number): Float64Array {
  const half = (win - 1) / 2, xs = Array.from({ length: win }, (_, j) => j - half);
  const V = xs.map(x => Array.from({ length: poly + 1 }, (_, k) => x ** k));
  const VtV = Array.from({ length: poly + 1 }, (_, a) => Array.from({ length: poly + 1 }, (_, b) => V.reduce((s, row) => s + row[a] * row[b], 0)));
  const x0 = pos - half;
  const d2 = Array.from({ length: poly + 1 }, (_, k) => k < 2 ? 0 : k * (k - 1) * x0 ** (k - 2));   // d²/dx² базиса в x0
  const w = solve(VtV, d2);                                                                       // (VᵀV)⁻¹·d2
  return Float64Array.from(V, row => row.reduce((s, v, k) => s + v * w[k], 0) / (dt * dt));
}

export function savgolDeriv2(x: Float64Array, win = 21, poly = 3, dt = DT): Float64Array {
  const n = x.length, half = (win - 1) / 2, out = new Float64Array(n);
  const mid = sgDeriv2Coeffs(win, poly, half, dt);
  const edge = Array.from({ length: win }, (_, p) => sgDeriv2Coeffs(win, poly, p, dt));
  for (let i = 0; i < n; i++) {
    const s = Math.min(Math.max(i - half, 0), n - win), c = (i - s === half) ? mid : edge[i - s];
    let acc = 0; for (let j = 0; j < win; j++) acc += c[j] * x[s + j];
    out[i] = acc;
  }
  return out;
}

// ---------------------------------------------------------------- 5. Рычаг (центр вращения → датчик), МНК

export function fitLever(a: Float64Array[], R: Float64Array, win = 21): { r: [number, number, number]; Rdd: Float64Array } {
  const n = a[0].length, Rdd = new Float64Array(9 * n);
  for (let e = 0; e < 9; e++) {
    const s = Float64Array.from({ length: n }, (_, i) => R[9 * i + e]);
    const d = savgolDeriv2(s, win);
    for (let i = 0; i < n; i++) Rdd[9 * i + e] = d[i];
  }
  const AtA = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], Atb = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let row = 0; row < 3; row++) {
    const o = 9 * i + 3 * row, b = a[row][i];
    for (let p = 0; p < 3; p++) { Atb[p] += Rdd[o + p] * b; for (let q = 0; q < 3; q++) AtA[p][q] += Rdd[o + p] * Rdd[o + q]; }
  }
  const r = solve(AtA, Atb) as [number, number, number];
  return { r, Rdd };
}

// ---------------------------------------------------------------- 6. Покой (почти-остановка)

export interface StationaryParams { gyroAbsDps: number; varFactor: number; varPercentile: number; varWindow: number; minLen: number; }
export const STATIONARY_DEFAULT: StationaryParams = { gyroAbsDps: 20, varFactor: 2, varPercentile: 50, varWindow: 10, minLen: 3 };

function percentile(x: Float64Array, p: number): number {                // как numpy (linear)
  const s = Float64Array.from(x).sort(), h = (s.length - 1) * p / 100, lo = Math.floor(h);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (h - lo);
}

export function stationaryMask(gyr: Float64Array[], a: Float64Array[], P: StationaryParams = STATIONARY_DEFAULT): Uint8Array {
  const n = a[0].length, am = new Float64Array(n), v = new Float64Array(n), z = new Uint8Array(n), out = new Uint8Array(n);
  for (let i = 0; i < n; i++) am[i] = Math.hypot(a[0][i], a[1][i], a[2][i]) / G;
  for (let i = 0; i < n; i++) {                                            // скользящая дисперсия, окно назад, ddof=1
    const s = Math.max(0, i - P.varWindow + 1), m = i - s + 1;
    if (m < 2) { v[i] = 0; continue; }
    let mu = 0; for (let j = s; j <= i; j++) mu += am[j]; mu /= m;
    let q = 0; for (let j = s; j <= i; j++) q += (am[j] - mu) ** 2;
    v[i] = q / (m - 1);
  }
  const thr = P.varFactor * percentile(v, P.varPercentile);
  for (let i = 0; i < n; i++) z[i] = (Math.hypot(gyr[0][i], gyr[1][i], gyr[2][i]) < P.gyroAbsDps && v[i] < thr) ? 1 : 0;
  for (let i = 0; i < n;) {                                                // оставить только серии ≥ minLen
    if (!z[i]) { i++; continue; }
    let j = i; while (j < n && z[j]) j++;
    if (j - i >= P.minLen) out.fill(1, i, j);
    i = j;
  }
  out.fill(1, 0, Math.min(3, n));
  return out;
}

// ---------------------------------------------------------------- 7. Интегрирование с обнулением скорости (ZUPT)

export function zuptIntegrate(a: Float64Array[], z: Uint8Array): Float64Array[] {
  const n = a[0].length, pos = [new Float64Array(n), new Float64Array(n), new Float64Array(n)];
  for (let k = 0; k < 3; k++) {
    const v = new Float64Array(n);
    for (let i = 1; i < n; i++) v[i] = z[i] ? 0 : v[i - 1] + a[k][i] * DT;
    for (let i = 0; i < n;) {                                              // скорость = 0 на обоих концах отрезка движения
      if (z[i]) { i++; continue; }
      const b = i; while (i < n && !z[i]) i++;
      if (i < n) { const L = i - b, ve = v[i - 1]; for (let j = b; j < i; j++) v[j] -= (j - b + 1) / L * ve; }
    }
    let p = 0; for (let i = 0; i < n; i++) { p += v[i] * DT; pos[k][i] = p; }
  }
  return pos;
}

// ---------------------------------------------------------------- 8. Траектория (единый алгоритм)

export interface Trajectory {
  p: Float64Array[];        // мм, итог = перенос + поворот, относительно старта
  base: Float64Array[];     // мм, перенос центра вращения
  rot: Float64Array[];      // мм, поворот датчика вокруг центра вращения
  stationary: Uint8Array;   // 1 = покой (скорость обнулена)
  leverM: [number, number, number]; // м, рычаг в осях датчика
}

export function computeTrajectory(rec: ImuRecord, P: StationaryParams = STATIONARY_DEFAULT): Trajectory {
  if (rec.displacementMode) throw new Error('Displacement mode: ускорение и гироскоп постоянны, траекторию построить нельзя');
  const R = rotationsFromEuler(rec.ang);
  const a = motionAcc(rec.acc, R);
  const { r, Rdd } = fitLever(a, R);
  const n = rec.n, rot = [new Float64Array(n), new Float64Array(n), new Float64Array(n)], ab = a.map(x => Float64Array.from(x));
  const r0 = mulRv(R, 0, r[0], r[1], r[2]);
  for (let i = 0; i < n; i++) {
    const w = mulRv(R, i, r[0], r[1], r[2]), dd = mulRv(Rdd, i, r[0], r[1], r[2]);
    for (let k = 0; k < 3; k++) { rot[k][i] = w[k] - r0[k]; ab[k][i] -= dd[k]; }
  }
  const z = stationaryMask(rec.gyr, ab, P);
  const base = zuptIntegrate(ab, z);
  const mm = (x: Float64Array) => x.map(v => v * 1000);
  return {
    p: [0, 1, 2].map(k => base[k].map((v, i) => (v + rot[k][i]) * 1000)),
    base: base.map(mm), rot: rot.map(mm), stationary: z, leverM: r,
  };
}

// ---------------------------------------------------------------- 9. DTW (N-мерный; для режима «по траектории»)
// Режимы roll/pitch и tip считаются существующим src/utils/dtwAlgorithm.ts (computeDtw2D) — он остаётся источником истины.

export function dtw(a: number[][], b: number[][]): { distance: number; normalized: number; path: [number, number][] } {
  const N = a.length, M = b.length, D = new Float64Array((N + 1) * (M + 1)).fill(Infinity), idx = (i: number, j: number) => i * (M + 1) + j;
  D[0] = 0;
  for (let i = 1; i <= N; i++) for (let j = 1; j <= M; j++) {
    let d = 0; for (let k = 0; k < a[i - 1].length; k++) d += (a[i - 1][k] - b[j - 1][k]) ** 2;
    D[idx(i, j)] = Math.sqrt(d) + Math.min(D[idx(i - 1, j - 1)], D[idx(i - 1, j)], D[idx(i, j - 1)]);
  }
  const path: [number, number][] = []; let i = N, j = M;
  while (i > 0 && j > 0) {
    path.push([i - 1, j - 1]);
    const dg = D[idx(i - 1, j - 1)], up = D[idx(i - 1, j)], lf = D[idx(i, j - 1)];
    if (dg <= up && dg <= lf) { i--; j--; } else if (up < lf) i--; else j--;
  }
  path.reverse();
  return { distance: D[idx(N, M)], normalized: D[idx(N, M)] / path.length, path };
}

// ---------------------------------------------------------------- 10. Адаптеры для существующего фронтенда

// Кончик [0,0,L] в осях комнаты = 3-й столбец R × L. Те же формулы, что computeTipPosition (2(q1q3+q0q2)·L, …), но на 100 Гц.
export function tipFromR(R: Float64Array, L = 1.8): { x: Float64Array; y: Float64Array; z: Float64Array } {
  const n = R.length / 9, x = new Float64Array(n), y = new Float64Array(n), z = new Float64Array(n);
  for (let i = 0; i < n; i++) { x[i] = R[9 * i + 2] * L; y[i] = R[9 * i + 5] * L; z[i] = R[9 * i + 8] * L; }
  return { x, y, z };
}

// Производная с постоянным шагом DT на полной частоте (центральная разность, края односторонние). Для PhasePortrait: считать ДО прореживания.
export function derivativeDt(x: Float64Array, dt = DT): Float64Array {
  const n = x.length, d = new Float64Array(n);
  if (n < 2) return d;
  d[0] = (x[1] - x[0]) / dt; d[n - 1] = (x[n - 1] - x[n - 2]) / dt;
  for (let i = 1; i < n - 1; i++) d[i] = (x[i + 1] - x[i - 1]) / (2 * dt);
  return d;
}

// Отрезок движения: от первого до последнего отсчёта вне покоя (для TremorSpectrum в режиме «только движение»).
export function motionSpan(stationary: Uint8Array): [number, number] | null {
  let a = 0, b = stationary.length - 1;
  while (a <= b && stationary[a]) a++;
  while (b >= a && stationary[b]) b--;
  return a <= b ? [a, b + 1] : null;
}

// Горизонтальное ускорение движения в осях комнаты, без гравитации, в g (дополнительная серия для IntensityProfile).
export function accMotionHorizG(a: Float64Array[]): Float64Array {
  return Float64Array.from(a[0], (v, i) => Math.hypot(v, a[1][i]) / G);
}

// Всё, что v5 добавляет к существующей модели данных. Считать один раз при загрузке (в Web Worker).
export interface SessionExtras {
  displacementMode: boolean;
  R: Float64Array;                                   // 9·n
  tip: { x: Float64Array; y: Float64Array; z: Float64Array };
  trajectory: Trajectory | null;                     // null при Displacement mode
  accMotionHorizG: Float64Array | null;
}

export function processSession(rec: ImuRecord): SessionExtras {
  const R = rotationsFromEuler(rec.ang);
  const tip = tipFromR(R);
  if (rec.displacementMode) return { displacementMode: true, R, tip, trajectory: null, accMotionHorizG: null };
  const trajectory = computeTrajectory(rec);
  return { displacementMode: false, R, tip, trajectory, accMotionHorizG: accMotionHorizG(motionAcc(rec.acc, R)) };
}
