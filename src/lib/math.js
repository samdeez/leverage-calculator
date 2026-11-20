// Pure trading math. Every function accepts strings or numbers and never throws.

export const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Percent change from `from` to `to`. Returns 0 when `from` is 0. */
export function pctChange(from, to) {
  const a = num(from);
  const b = num(to);
  if (!a) return 0;
  return ((b - a) / a) * 100;
}

export const priceFromPct = (entry, pct) => num(entry) * (1 + num(pct) / 100);

/** Number of decimals that keeps ~5 significant digits for a price. */
export function priceDecimals(price) {
  const p = Math.abs(num(price));
  if (!p) return 2;
  if (p >= 1000) return 2;
  if (p >= 1) return 4;
  return Math.min(12, Math.ceil(-Math.log10(p)) + 4);
}

/** Round and strip trailing zeros, returned as a plain numeric string. */
export function toNumStr(v, decimals = 8) {
  const n = num(v);
  return String(Number(n.toFixed(Math.max(0, Math.min(20, decimals)))));
}

/** A sensible arrow-key step for a value: ~1% of its magnitude. */
export function autoStep(value) {
  const v = Math.abs(num(value));
  if (!v) return 1;
  return Math.pow(10, Math.floor(Math.log10(v)) - 2);
}

export const decimalsOf = (step) => {
  const s = String(step);
  if (s.includes("e-")) return Number(s.split("e-")[1]);
  return s.includes(".") ? s.split(".")[1].length : 0;
};

/* ------------------------------------------------------------------ spot */

/** Spot trade. `feePct` is a round-trip fee charged on the amount invested. */
export function spotTrade({ invest, entry, exit, feePct = 0 }) {
  const inv = num(invest);
  const en = num(entry);
  const ex = num(exit);
  const tokens = en > 0 ? inv / en : 0;
  const exitValue = tokens * ex;
  const gross = ex ? exitValue - inv : 0;
  const fees = (inv * num(feePct)) / 100;
  const pnl = gross - fees;
  const roi = inv ? (pnl / inv) * 100 : 0;
  const breakEven = tokens ? (inv + fees) / tokens : 0;
  return {
    tokens,
    exitValue,
    gross,
    fees,
    pnl,
    roi: Math.max(-100, roi),
    equity: inv + pnl,
    breakEven,
    move: pctChange(en, ex),
  };
}

/** Compound `pct` per trade over `trades` trades. Series is capped to ~400 points. */
export function compound(invest, pct, trades) {
  const inv = num(invest);
  const r = 1 + num(pct) / 100;
  const n = Math.max(0, Math.min(10000, Math.floor(num(trades))));
  const final = inv * Math.pow(r, n);
  const every = Math.max(1, Math.ceil(n / 400));
  const series = [];
  for (let i = 0; i <= n; i += every) series.push({ x: i, y: inv * Math.pow(r, i) });
  if (series.length && series[series.length - 1].x !== n) series.push({ x: n, y: final });
  return { final, profit: final - inv, multiple: inv ? final / inv : 0, series };
}

/* -------------------------------------------------------------- leverage */

export function liquidationPrice(entry, leverage, side = "long", mmrPct = 0) {
  const en = num(entry);
  const lev = num(leverage);
  if (!en || !lev) return 0;
  const m = num(mmrPct) / 100;
  const p = side === "short" ? en * (1 + 1 / lev - m) : en * (1 - 1 / lev + m);
  return Math.max(0, p);
}

/**
 * Perpetual/leverage trade.
 * - `feePct`: round-trip fee as % of position size (notional)
 * - `fundingPct`: funding % of notional per hour, paid for `hours`
 * - `mmrPct`: maintenance margin rate used for the liquidation estimate
 */
export function leverageTrade({
  collateral,
  entry,
  exit,
  leverage,
  side = "long",
  feePct = 0,
  fundingPct = 0,
  hours = 0,
  mmrPct = 0,
}) {
  const col = num(collateral);
  const en = num(entry);
  const ex = num(exit);
  const lev = num(leverage);
  const dir = side === "short" ? -1 : 1;
  const size = col * lev;
  const qty = en > 0 ? size / en : 0;
  const gross = en > 0 && ex ? qty * (ex - en) * dir : 0;
  const fees = (size * num(feePct)) / 100;
  const funding = ((size * num(fundingPct)) / 100) * num(hours);
  const liq = liquidationPrice(en, lev, side, mmrPct);
  const liquidated = !!ex && liq > 0 && (side === "short" ? ex >= liq : ex <= liq);
  let pnl = gross - fees - funding;
  if (liquidated || pnl < -col) pnl = -col;
  const costs = fees + funding;
  return {
    size,
    qty,
    gross,
    fees,
    funding,
    pnl,
    roi: col ? (pnl / col) * 100 : 0,
    equity: col + pnl,
    liq,
    liqLong: liquidationPrice(en, lev, "long", mmrPct),
    liqShort: liquidationPrice(en, lev, "short", mmrPct),
    liqDistance: pctChange(en, liq),
    liquidated,
    breakEven: qty ? en + (dir * costs) / qty : 0,
    move: pctChange(en, ex),
  };
}

/* ----------------------------------------------------------------- tools */

export function positionSize({ account, riskPct, entry, stop, target, leverage = 1 }) {
  const acc = num(account);
  const en = num(entry);
  const st = num(stop);
  const tg = num(target);
  const riskAmount = (acc * num(riskPct)) / 100;
  const perUnit = Math.abs(en - st);
  const qty = perUnit && en ? riskAmount / perUnit : 0;
  const size = qty * en;
  const reward = tg ? qty * Math.abs(tg - en) : 0;
  const lev = Math.max(1, num(leverage));
  return {
    riskAmount,
    qty,
    size,
    side: st && st > en ? "short" : "long",
    margin: size / lev,
    leverageNeeded: acc ? size / acc : 0,
    stopPct: pctChange(en, st),
    targetPct: pctChange(en, tg),
    reward,
    rr: riskAmount && reward ? reward / riskAmount : 0,
  };
}

/** Dollar-cost average over a list of { price, amount } buys (amount in USD). */
export function dcaAverage(buys) {
  let usd = 0;
  let qty = 0;
  for (const b of buys) {
    const p = num(b.price);
    const a = num(b.amount);
    if (p > 0 && a > 0) {
      usd += a;
      qty += a / p;
    }
  }
  return { usd, qty, avg: qty ? usd / qty : 0 };
}

export const SCENARIO_MOVES = [-50, -25, -10, -5, -2, 2, 5, 10, 25, 50, 100];
