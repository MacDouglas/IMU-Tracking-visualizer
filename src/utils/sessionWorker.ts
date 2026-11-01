import { loadSession, extrasTransferables, type SessionResult } from './sessionLoader';

export type SessionRequest = { id: number; raw: string };
export type SessionResponse = { id: number } & SessionResult;

self.onmessage = (e: MessageEvent<SessionRequest>) => {
  const { id, raw } = e.data;
  let result: SessionResult;
  try {
    result = loadSession(raw);
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  const response: SessionResponse = { id, ...result };
  self.postMessage(response, { transfer: result.ok ? extrasTransferables(result.extras) : [] });
};
