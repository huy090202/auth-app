import { useCallback, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router';

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

/** The stored preference, for the demo and the one-time redirect. Null when storage is blocked or empty. */
export function storedLang(): Lang {
  return read();
}

/** Remember the choice without moving anywhere. */
export function storeLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* storage blocked: the choice lasts until reload */
  }
  listeners.forEach((fn) => fn());
}

/** Split `/a?b#c` into the path and the `?b#c` tail. */
function split(path: string): [string, string] {
  const i = path.search(/[?#]/);
  return i < 0 ? [path, ''] : [path.slice(0, i), path.slice(i)];
}

/** `vi` when the path is `/vi` or starts with `/vi/`, else `en`. */
export function langFromPath(path: string): Lang {
  const [p] = split(path);
  return p === '/vi' || p.startsWith('/vi/') ? 'vi' : 'en';
}

/** The path without its language prefix: `/vi` and `/vi/` become `/`. */
function stripLang(p: string): string {
  if (p === '/vi') return '/';
  return p.startsWith('/vi/') ? p.slice(3) : p;
}

/** The path in the given language: EN has no prefix, VI has `/vi` (`/` becomes `/vi/`). Search and hash are kept. */
export function localePath(lang: Lang, path: string): string {
  const [p, tail] = split(path);
  const base = stripLang(p);
  if (lang === 'en') return base + tail;
  return (base === '/' ? '/vi/' : `/vi${base}`) + tail;
}

/** The same page in the other language, keeping search and hash. */
export function twinPath(path: string, to: Lang): string {
  return localePath(to, path);
}

/** Landing and docs routes carry the language in the URL; the demo does not. */
export function isLocaleRoute(pathname: string): boolean {
  const p = stripLang(split(pathname)[0]);
  return p === '/' || p === '/docs' || p.startsWith('/docs/');
}

export function useLang(): [Lang, (l: Lang) => void] {
  const stored = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    read,
    () => 'en' as Lang,
  );
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const onLocale = isLocaleRoute(pathname);
  const lang = onLocale ? langFromPath(pathname) : stored;
  const set = useCallback((l: Lang) => {
    storeLang(l);
    if (onLocale) navigate(twinPath(pathname + search + hash, l));
  }, [onLocale, navigate, pathname, search, hash]);
  return [lang, set];
}
