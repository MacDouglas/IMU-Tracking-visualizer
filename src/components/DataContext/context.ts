import { createContext, useContext } from 'react';
import type { SensorRow } from '../../utils/tsvParser';
import type { ImuVisualizationData } from '../../types/imu';
import type { TremorAnalysis } from '../../types/tremor';
import type { SessionExtras } from '../../utils/imuProcessing';

export type AppTab = 'motion' | 'tremor' | 'comparison';

export interface DataContextValue {
  rows: SensorRow[];
  /** v5.1 additions computed at load: R, tip, trajectory, Displacement mode. Null until loaded. */
  extras: SessionExtras | null;
  /** Parse and process a raw TSV file in a Web Worker. */
  loadRaw: (raw: string) => void;
  isLoading: boolean;
  loadError: string | null;
  vizData: ImuVisualizationData | null;
  tremorData: TremorAnalysis | null;
  isProcessing: boolean;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  currentIndex: number;
  setCurrentIndex: (i: number | ((prev: number) => number)) => void;
}

export const DataContext = createContext<DataContextValue>({
  rows: [],
  extras: null,
  loadRaw: () => {},
  isLoading: false,
  loadError: null,
  vizData: null,
  tremorData: null,
  isProcessing: false,
  activeTab: 'motion',
  setActiveTab: () => {},
  currentIndex: 0,
  setCurrentIndex: () => {},
});

export function useData() {
  return useContext(DataContext);
}
