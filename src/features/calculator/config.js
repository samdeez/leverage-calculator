import { compound, leverageTrade, spotTrade } from "../../lib/math";

export const DEFAULTS = {
  spot: { asset: "SOL", invest: "200", entry: "88", exit: "", pct: "", anchor: "exit", fee: "0", trades: "1" },
  leverage: {
    asset: "SOL",
    invest: "",
    entry: "",
    exit: "",
    pct: "",
    anchor: "exit",
    side: "long",
    leverage: "6",
    fee: "0.2",
    funding: "0.007",
    hours: "48",
    mmr: "0",
  },
};

/** Run the trade math for a calculator state, optionally at a different exit. */
export function runCalc(mode, s, exit = s.exit) {
  if (mode === "spot") {
    return spotTrade({ invest: s.invest, entry: s.entry, exit, feePct: s.fee });
  }
  return leverageTrade({
    collateral: s.invest,
    entry: s.entry,
    exit,
    leverage: s.leverage,
    side: s.side,
    feePct: s.fee,
    fundingPct: s.funding,
    hours: s.hours,
    mmrPct: s.mmr,
  });
}

export const runCompound = (s) => compound(s.invest, s.pct, s.trades);

const SHARE_KEYS = {
  spot: ["asset", "invest", "entry", "exit", "fee", "trades"],
  leverage: ["asset", "invest", "entry", "exit", "side", "leverage", "fee", "funding", "hours", "mmr"],
};

export function toShareHash(mode, s) {
  const q = new URLSearchParams();
  for (const k of SHARE_KEYS[mode]) if (s[k] !== "" && s[k] != null) q.set(k, s[k]);
  return `#${mode}?${q.toString()}`;
}

/** Parse "#spot?invest=…" into a partial state, or null if it's for another mode. */
export function fromShareHash(mode, hash) {
  const m = /^#(spot|leverage)\?(.*)$/.exec(hash || "");
  if (!m || m[1] !== mode) return null;
  const q = new URLSearchParams(m[2]);
  const out = {};
  for (const k of SHARE_KEYS[mode]) if (q.has(k)) out[k] = q.get(k);
  return out;
}
