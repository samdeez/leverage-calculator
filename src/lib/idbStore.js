// A minimal external store persisted in IndexedDB, shared across components.
import { useSyncExternalStore } from "react";
import { idbGet, idbSet } from "./storage";

export function createIdbStore(key, initial) {
  let state = initial;
  let loaded = false;
  const listeners = new Set();
  const ready = idbGet(key, initial).then((v) => {
    // Writes that happened before the load finished win over stored data.
    if (!loaded) state = v ?? initial;
    loaded = true;
    listeners.forEach((l) => l());
  });

  const get = () => state;
  const set = (next) => {
    state = typeof next === "function" ? next(state) : next;
    loaded = true;
    idbSet(key, state);
    listeners.forEach((l) => l());
  };
  const subscribe = (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const use = () => useSyncExternalStore(subscribe, get, get);
  return { get, set, subscribe, use, ready };
}

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Saved calculator scenarios / trade journal. */
export const journalStore = createIdbStore("journal.v1", []);

/** Price alerts: [{ id, symbol, op: "above" | "below", price, active, firedAt }] */
export const alertsStore = createIdbStore("alerts.v1", []);
