import { useSyncExternalStore } from 'react';

export type TraceEntry = {
  method: string;
  path: string;
  requestBody?: unknown;
  status: number;
  responseBody?: unknown;
  ms: number;
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const traceStore = {
  entries: [] as TraceEntry[],
  push(e: TraceEntry[]) {
    // New array so useSyncExternalStore sees a change.
    traceStore.entries = [...traceStore.entries, ...e];
    emit();
  },
  clear() {
    traceStore.entries = [];
    emit();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export const useTrace = () => useSyncExternalStore(traceStore.subscribe, () => traceStore.entries);
