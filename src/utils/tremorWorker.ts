import { runTremorPipeline, downsampleTremor } from './tremorPipeline';
import { DEFAULT_TREMOR_PARAMS } from '../types/tremor';

self.onmessage = (e: MessageEvent<{ t: number[]; gyroX: number[] }>) => {
  const { t, gyroX } = e.data;
  const result = runTremorPipeline(t, gyroX, DEFAULT_TREMOR_PARAMS);
  self.postMessage(downsampleTremor(result, 300));
};
