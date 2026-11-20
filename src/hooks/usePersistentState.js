import { useCallback, useEffect, useRef, useState } from "react";
import { idbGet, idbSet, lsGet, lsSet } from "../lib/storage";

/** useState persisted to localStorage (debounced writes). */
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    const init = typeof initial === "function" ? initial() : initial;
    const stored = lsGet(key, undefined);
    if (stored === undefined) return init;
    // Merge objects so new fields get their defaults after upgrades.
    return init && typeof init === "object" && !Array.isArray(init) ? { ...init, ...stored } : stored;
  });
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => lsSet(key, value), 150);
    return () => clearTimeout(timer.current);
  }, [key, value]);
  return [value, setValue];
}

/** useState persisted to IndexedDB. Returns [value, set, loaded]. */
export function useIdbState(key, initial) {
  const [value, setValue] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  useEffect(() => {
    let alive = true;
    idbGet(key, initial).then((v) => {
      if (!alive) return;
      loadedRef.current = true;
      setValue((cur) => (cur === initial ? v ?? initial : cur));
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const timer = useRef(null);
  useEffect(() => {
    if (!loadedRef.current) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => idbSet(key, value), 300);
    return () => clearTimeout(timer.current);
  }, [key, value]);
  const set = useCallback((v) => setValue(v), []);
  return [value, set, loaded];
}
