// Portfolio value history: append-only snapshots with automatic compaction.

export const MAX_POINTS = 3000;

/**
 * Append a snapshot { t, total, wallets: { [id]: value } } once at least
 * `minGapMs` has passed since the last one. Points are never rewritten, so
 * the line only moves on real, spaced-out observations.
 */
export function addSnapshot(history, snap, minGapMs) {
  const last = history[history.length - 1];
  if (last && snap.t - last.t < minGapMs) return history;
  const list = [...history, snap];
  return list.length > MAX_POINTS ? compact(list) : list;
}

/** Halve the density of the oldest half of the history. */
export function compact(list) {
  const half = Math.floor(list.length / 2);
  const old = list.slice(0, half).filter((_, i) => i % 2 === 0);
  return [...old, ...list.slice(half)];
}

export const RANGES = {
  "1D": 864e5,
  "1W": 7 * 864e5,
  "1M": 30 * 864e5,
  "3M": 90 * 864e5,
  ALL: Infinity,
};

export function seriesFor(history, { range = "ALL", walletId = null, now = Date.now() } = {}) {
  const span = RANGES[range] ?? Infinity;
  return history
    .filter((s) => now - s.t <= span)
    .map((s) => ({ x: s.t, y: walletId ? s.wallets?.[walletId] ?? null : s.total }))
    .filter((p) => p.y != null);
}

export function seriesStats(series) {
  if (!series.length) return { first: 0, last: 0, change: 0, changePct: 0, high: 0, low: 0 };
  const first = series[0].y;
  const last = series[series.length - 1].y;
  let high = -Infinity;
  let low = Infinity;
  for (const p of series) {
    if (p.y > high) high = p.y;
    if (p.y < low) low = p.y;
  }
  return { first, last, change: last - first, changePct: first ? ((last - first) / first) * 100 : 0, high, low };
}
