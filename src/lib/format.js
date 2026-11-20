import { num } from "./math";

const cache = new Map();
const nf = (min, max, extra = {}) => {
  const key = `${min}:${max}:${JSON.stringify(extra)}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: min,
        maximumFractionDigits: max,
        ...extra,
      })
    );
  }
  return cache.get(key);
};

/** Format a number with `dp` max decimals and `min` min decimals. */
export function fmt(v, dp = 2, min = 0) {
  return nf(Math.min(min, dp), dp).format(num(v));
}

/** Smart price: more decimals for small prices. */
export function fmtPrice(v) {
  const n = Math.abs(num(v));
  if (!n) return "0";
  if (n >= 1000) return fmt(v, 2);
  if (n >= 1) return fmt(v, 4);
  return nf(0, 12, { maximumSignificantDigits: 5 }).format(num(v));
}

export function fmtUsd(v, { sign = false, dp = 2 } = {}) {
  const n = num(v);
  const s = sign && n > 0 ? "+" : n < 0 ? "-" : "";
  return `${s}$${fmt(Math.abs(n), dp, Math.min(dp, 2))}`;
}

export function fmtPct(v, { sign = true, dp = 2 } = {}) {
  const n = num(v);
  return `${sign && n > 0 ? "+" : ""}${fmt(n, dp, dp)}%`;
}

export function fmtCompact(v, dp = 2) {
  const n = num(v);
  if (Math.abs(n) < 10000) return fmt(n, dp);
  return nf(0, dp, { notation: "compact" }).format(n);
}

export function fmtToken(v) {
  const n = Math.abs(num(v));
  if (!n) return "0";
  if (n >= 1e6) return fmtCompact(v, 2);
  if (n >= 1) return fmt(v, 4);
  return nf(0, 12, { maximumSignificantDigits: 6 }).format(num(v));
}

export const shortAddr = (a = "", n = 4) =>
  a.length > n * 2 + 3 ? `${a.slice(0, n)}…${a.slice(-n)}` : a;

export function timeAgo(t, now = Date.now()) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function fmtDate(t, withTime = true) {
  return new Date(t).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : { year: "numeric" }),
  });
}

export const signClass = (v) => (num(v) > 0 ? "pos" : num(v) < 0 ? "neg" : "");
