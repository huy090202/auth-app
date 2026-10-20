import { useCallback, useSyncExternalStore } from 'react';

export type Lang = 'en' | 'vi';
const KEY = 'auth-app.lang';
const listeners = new Set<() => void>();

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === 'vi' ? 'vi' : 'en';
  } catch {
    return 'en';
  }
}

export function useLang(): [Lang, (l: Lang) => void] {
  const lang = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    read,
    () => 'en' as Lang,
  );
  const set = useCallback((l: Lang) => {
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* storage blocked: the choice lasts until reload */
    }
    listeners.forEach((fn) => fn());
  }, []);
  return [lang, set];
}
