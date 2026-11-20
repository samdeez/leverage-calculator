import { useEffect, useState } from "react";
import { liveFeed } from "../lib/live";

/** Subscribe to a live price. Returns the latest tick or undefined. */
export function useLivePrice(symbol, enabled = true) {
  const [tick, setTick] = useState(() => (symbol ? liveFeed.get(String(symbol).toUpperCase()) : undefined));
  useEffect(() => {
    if (!symbol || !enabled) return undefined;
    setTick(liveFeed.get(String(symbol).toUpperCase()));
    return liveFeed.subscribe(symbol, setTick);
  }, [symbol, enabled]);
  return tick;
}

/** Subscribe to many symbols at once: { [symbol]: tick } */
export function useLivePrices(symbols) {
  const key = [...new Set(symbols.filter(Boolean))].sort().join(",");
  const [ticks, setTicks] = useState({});
  useEffect(() => {
    if (!key) return undefined;
    const unsubs = key.split(",").map((s) => liveFeed.subscribe(s, (t) => setTicks((cur) => ({ ...cur, [s]: t }))));
    return () => unsubs.forEach((u) => u());
  }, [key]);
  return ticks;
}

export function useFeedStatus() {
  const [status, setStatus] = useState(liveFeed.status);
  useEffect(() => liveFeed.onStatus(setStatus), []);
  return status;
}
