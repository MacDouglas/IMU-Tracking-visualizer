// utils/sessionLoader.ts
//
// Parses one TSV recording into what DataContext stores (v5.1, §2):
//   rows   — frontend SensorRow[] (time = i·DT), used by existing panels
//   extras — imuProcessing.processSession: R, tip, trajectory, Displacement mode
// Both parsers read the same text; their row counts must match, otherwise
// indices into rows and extras would silently drift apart.

import { parseTSV, type SensorRow } from './tsvParser';
import {
  parseTsv, processSession, rotationsFromEuler, tipFromR,
  type SessionExtras,
} from './imuProcessing';

/** Savitzky–Golay window used by fitLever: shorter recordings can't give a trajectory. */
const MIN_TRAJECTORY_SAMPLES = 21;

export type SessionResult =
  | { ok: true; rows: SensorRow[]; extras: SessionExtras }
  | { ok: false; error: string };

export function loadSession(raw: string): SessionResult {
  const rows = parseTSV(raw);
  if (rows.length < 2) return { ok: false, error: 'В файле нет данных' };

  const rec = parseTsv(raw);
  if (rec.n !== rows.length) {
    return {
      ok: false,
      error: `Не совпадает число строк (${rows.length} и ${rec.n}): проверьте, что первая строка файла — заголовок`,
    };
  }

  if (rec.n < MIN_TRAJECTORY_SAMPLES) {
    const R = rotationsFromEuler(rec.ang);
    const extras: SessionExtras = {
      displacementMode: rec.displacementMode, R, tip: tipFromR(R), trajectory: null, accMotionHorizG: null,
    };
    return { ok: true, rows, extras };
  }

  return { ok: true, rows, extras: processSession(rec) };
}

/** ArrayBuffers of all typed arrays in extras, for zero-copy postMessage. */
export function extrasTransferables(e: SessionExtras): ArrayBuffer[] {
  const arrays: ArrayBufferView[] = [e.R, e.tip.x, e.tip.y, e.tip.z];
  if (e.accMotionHorizG) arrays.push(e.accMotionHorizG);
  if (e.trajectory) {
    const T = e.trajectory;
    arrays.push(...T.p, ...T.base, ...T.rot, T.stationary);
  }
  // A buffer listed twice makes postMessage throw DataCloneError.
  return [...new Set(arrays.map(a => a.buffer as ArrayBuffer))];
}
