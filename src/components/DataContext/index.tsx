import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { SensorRow } from '../../utils/tsvParser';
import type { TremorAnalysis } from '../../types/tremor';
import type { SessionExtras } from '../../utils/imuProcessing';
import type { SessionRequest, SessionResponse } from '../../utils/sessionWorker';
import { buildVizData } from '../../utils/signalProcessing';
import { DataContext } from './context';
import type { AppTab } from './context';

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [rows, setRows] = useState<SensorRow[]>([]);
  const [extras, setExtras] = useState<SessionExtras | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndexState] = useState(0);
  const [tremorData, setTremorData] = useState<TremorAnalysis | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('motion');
  const workerRef = useRef<Worker | null>(null);
  const sessionWorkerRef = useRef<Worker | null>(null);
  // Incremented on every load; responses for older loads are dropped.
  const loadIdRef = useRef(0);

  const vizData = useMemo(() => {
    if (rows.length < 2 || !extras) return null;
    return buildVizData(rows, extras, 120);
  }, [rows, extras]);

  // Start tremor analysis lazily — only when tremor tab is active
  useEffect(() => {
    // Displacement mode: gyro is all zeros, tremor analysis is meaningless (v5.1 §1 №11)
    if (activeTab !== 'tremor' || rows.length < 100 || tremorData !== null || extras?.displacementMode) return;

    workerRef.current?.terminate();
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  }, [activeTab, rows, tremorData, extras]);

  const loadRaw = useCallback((raw: string) => {
    const id = ++loadIdRef.current;
    sessionWorkerRef.current?.terminate();
    setIsLoading(true);
    setLoadError(null);

    const worker = new Worker(
      new URL('../../utils/sessionWorker.ts', import.meta.url),
      { type: 'module' }
    );
    sessionWorkerRef.current = worker;

    // Replaces the whole session (success or failure); stale loads are ignored.
    const settle = (result: { rows: SensorRow[]; extras: SessionExtras | null; error: string | null }) => {
      worker.terminate();
      if (sessionWorkerRef.current === worker) sessionWorkerRef.current = null;
      if (id !== loadIdRef.current) return;
      workerRef.current?.terminate(); // tremor analysis of the previous file
      setTremorData(null);
      setIsProcessing(false);
      setCurrentIndexState(0);
      setRows(result.rows);
      setExtras(result.extras);
      setLoadError(result.error);
      setIsLoading(false);
    };

    worker.onmessage = (e: MessageEvent<SessionResponse>) => {
      const d = e.data;
      settle(d.ok
        ? { rows: d.rows, extras: d.extras, error: null }
        : { rows: [], extras: null, error: d.error });
    };

    worker.onerror = (e) => {
      settle({ rows: [], extras: null, error: e.message || 'Ошибка обработки файла' });
    };

    const request: SessionRequest = { id, raw };
    worker.postMessage(request);
  }, []);

  useEffect(() => () => sessionWorkerRef.current?.terminate(), []);

  const setCurrentIndex = useCallback((i: number | ((prev: number) => number)) => {
    setCurrentIndexState(i);
  }, []);

  return (
    <DataContext.Provider value={{
      rows,
      extras,
      loadRaw,
      isLoading,
      loadError,
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
