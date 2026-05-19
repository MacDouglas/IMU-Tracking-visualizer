import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { SensorRow } from '../../utils/tsvParser';
import type { TremorAnalysis } from '../../types/tremor';
import { buildVizData } from '../../utils/signalProcessing';
import { DataContext } from './context';
import type { AppTab } from './context';

export type { AppTab } from './context';
export { useData } from './context';

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [rows, setRows] = useState<SensorRow[]>([]);
  const [currentIndex, setCurrentIndexState] = useState(0);
  const [tremorData, setTremorData] = useState<TremorAnalysis | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('motion');
  const workerRef = useRef<Worker | null>(null);

  const vizData = useMemo(() => {
    if (rows.length < 2) return null;
    return buildVizData(rows, 120);
  }, [rows]);

  // Reset tremor state when new file is loaded
  useEffect(() => {
    setTremorData(null);
    setIsProcessing(false);
    workerRef.current?.terminate();
  }, [rows]);

  // Start tremor analysis lazily — only when tremor tab is active
  useEffect(() => {
    if (activeTab !== 'tremor' || rows.length < 100 || tremorData !== null) return;

    workerRef.current?.terminate();
    setIsProcessing(true);

    const worker = new Worker(
      new URL('../../utils/tremorWorker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<TremorAnalysis>) => {
      setTremorData(e.data);
      setIsProcessing(false);
      worker.terminate();
    };

    worker.onerror = () => {
      setIsProcessing(false);
      worker.terminate();
    };

    worker.postMessage({
      t: rows.map(r => r.time),
      gyroX: rows.map(r => r.asX),
    });

    return () => worker.terminate();
  }, [activeTab, rows, tremorData]);

  const handleSetRows = useCallback((newRows: SensorRow[]) => {
    setRows(newRows);
    setCurrentIndexState(0);
  }, []);

  const setCurrentIndex = useCallback((i: number | ((prev: number) => number)) => {
    setCurrentIndexState(i);
  }, []);

  return (
    <DataContext.Provider value={{
      rows,
      setRows: handleSetRows,
      vizData,
      tremorData,
      isProcessing,
      activeTab,
      setActiveTab,
      currentIndex,
      setCurrentIndex,
    }}>
      {children}
    </DataContext.Provider>
  );
}
