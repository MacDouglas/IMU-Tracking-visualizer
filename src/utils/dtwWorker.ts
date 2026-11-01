import { runDtwPipeline } from './dtwPipeline';
import type { DtwComparisonData } from '../types/dtw';

export type DtwRequest = { id: number; tsv1: string; tsv2: string; label1: string; label2: string };
export type DtwResponse =
  | { id: number; ok: true; data: DtwComparisonData }
  | { id: number; ok: false; error: string };

self.onmessage = (e: MessageEvent<DtwRequest>) => {
  const { id, tsv1, tsv2, label1, label2 } = e.data;
  let response: DtwResponse;
  try {
    response = { id, ok: true, data: runDtwPipeline(tsv1, tsv2, label1, label2) };
  } catch (err) {
    response = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(response);
};
