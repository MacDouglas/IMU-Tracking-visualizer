import { createContext, useContext } from 'react';
import type { SensorRow } from '../../utils/tsvParser';
import type { ImuVisualizationData } from '../../types/imu';
import type { TremorAnalysis } from '../../types/tremor';

export type AppTab = 'motion' | 'tremor' | 'comparison';

export interface DataContextValue {
  rows: SensorRow[];
  setRows: (rows: SensorRow[]) => void;
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
  setRows: () => {},
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
