// Global app settings, persisted to localStorage and readable outside React.
import { useSyncExternalStore } from "react";
import { lsGet, lsSet } from "./storage";

const KEY = "levcal:settings.v1";

export const DEFAULT_SETTINGS = {
  localSymbol: "T",
  localRate: 200000,
  showLocal: true,
  solanaRpc: "https://solana-rpc.publicnode.com",
  solanaWs: "",
  jupiterKey: "",
  priceSource: "auto", // auto | coinbase | okx | poll
  refreshSec: 30,
  snapshotMin: 5,
  showHints: true,
  privacy: false,
  dustUsd: 1,
};

let state = { ...DEFAULT_SETTINGS, ...lsGet(KEY, {}) };
const listeners = new Set();

export const getSettings = () => state;

export function setSettings(patch) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  lsSet(KEY, state);
  listeners.forEach((l) => l());
}

export function resetSettings() {
  setSettings({ ...DEFAULT_SETTINGS });
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSettings() {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}

/** Solana websocket endpoint: explicit setting, else derived from the RPC URL. */
export function solanaWsUrl(s = state) {
  if (s.solanaWs) return s.solanaWs;
  return s.solanaRpc.replace(/^http/, "ws");
}
