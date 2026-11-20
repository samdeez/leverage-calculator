// Wallet activity: per-transaction balance changes, classified as trades
// (swaps) or other activity (send / receive / other / failed).
//
// Event shape:
// { id, time, chain, kind, ok, url, fee, feeKey,
//   changes: [{ key, chain, assetId, symbol, amount, price }] }
// `amount` is signed (+ received, − sent) and excludes network fees.
import { getJson } from "./http";
import { SOL_MINT, jupPrices, jupTokenMeta } from "./jupiter";
import { getSettings } from "./settingsStore";

export const KINDS = {
  swap: { label: "SWAP", tone: "" },
  arb: { label: "ARB", tone: "gold" },
  receive: { label: "RECEIVE", tone: "pos" },
  send: { label: "SEND", tone: "neg" },
  other: { label: "OTHER", tone: "" },
  failed: { label: "FAILED", tone: "warn" },
  failedTrade: { label: "FAILED TRADE", tone: "warn" },
};

/** Trade kinds: shown under "Trades" and moved by the "Trades" history mode. */
export const TRADE_KINDS = new Set(["swap", "arb"]);
export const isTrade = (e) => TRADE_KINDS.has(e.kind);
/** A failed DEX transaction: a trade attempt that only cost its fee. */
export const isFailedTrade = (e) => e.kind === "failed" && !!e.dex;

/**
 * Classify by the signs of the balance changes. A transaction that went
 * through a DEX (`dex`) is always a trade: a swap when value moved between
 * different tokens, otherwise an arbitrage — a round trip that starts and
 * ends in the same token, leaving only the profit or loss as a net change.
 */
export function classify(changes, ok = true, dex = false, routeLength = 2) {
  if (!ok) return "failed";
  const pos = changes.some((c) => c.amount > 0);
  const neg = changes.some((c) => c.amount < 0);
  if (dex && pos && neg) return "swap";
  // An arbitrage passes through at least two tokens and nets out in at most one.
  const netAssets = new Set(changes.map((c) => c.assetId ?? c.key)).size;
  if (dex && routeLength >= 2 && netAssets <= 1) return "arb";
  if (pos && neg) return "swap";
  if (neg) return "send";
  if (pos) return "receive";
  return "other";
}

const EPS = 1e-9;

// DEX and aggregator programs. Transactions that invoke one are trades.
const DEX_PROGRAMS = new Set([
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", // Jupiter v6
  "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB", // Jupiter v4
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", // Raydium AMM v4
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK", // Raydium CLMM
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C", // Raydium CPMM
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", // Orca Whirlpool
  "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP", // Orca v2
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo", // Meteora DLMM
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB", // Meteora pools
  "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG", // Meteora DAMM v2
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", // Pump.fun
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA", // PumpSwap
  "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY", // Phoenix
  "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb", // OpenBook v2
  "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX", // OpenBook
  "2wT8Yq49kHgDzXuPxZSaeLaH1qbmGXtEyPy64bL7aD3c", // Lifinity v2
  "SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ", // Saber
  "SoLFiHG9TfgtdUXUjWAxi3LtvYuFyDLVhBWxdMZxyCe", // SolFi
  "9H6tua7jkLhdm3w8BvgpTn5LZNU7g4ZynDmCiNN3q6Rp", // HumidiFi
  "swapNyd8XiQwJ6ianp9snpu4brUqFxadzvHebnAXjJZ", // Stabble
  "ZERor4xhbUycZ6gb9ntrhqscUcZmAbQDjEAtCf4hbZY", // ZeroFi
  "obriQD1zbpyLz95G5n7nJe6a4DPjpFwa5XYPoNm113y", // Obric
  "DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1", // Orca v1
]);
// Most DEX programs log their instruction names; this catches the long tail.
const DEX_LOG = /Instruction: (Swap\w*|Route\w*|SharedAccountsRoute\w*|ExactOut\w*|Buy|Sell)\b|ray_log/;

function usesDex(tx) {
  const progs = [];
  for (const ix of tx.transaction?.message?.instructions || []) progs.push(ix.programId);
  for (const inner of tx.meta?.innerInstructions || []) for (const ix of inner.instructions || []) progs.push(ix.programId);
  if (progs.some((p) => DEX_PROGRAMS.has(p))) return true;
  return (tx.meta?.logMessages || []).some((l) => DEX_LOG.test(l));
}
const rpcBody = (id, method, params) => ({ jsonrpc: "2.0", id, method, params });

/** Human-readable reason for a failed request, with the likely fix. */
export function explainError(err, source = "Solana RPC") {
  if (err?.name === "AbortError") return `${source} timed out — it may be blocked on this network. Try your own RPC in Settings.`;
  if (err instanceof TypeError) return `${source} unreachable from this network. Try your own RPC in Settings.`;
  if (err?.status === 403 || err?.status === 401) return `${source} refused the request (${err.status}). Use an RPC with history access in Settings.`;
  if (err?.status === 429) return `${source} rate-limited — retrying shortly.`;
  return err?.message || String(err);
}

async function solBatch(calls, timeout = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(getSettings().solanaRpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(calls.length === 1 ? calls[0] : calls),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const err = new Error(`Solana RPC ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const out = await res.json();
    return Array.isArray(out) ? out : [out];
  } finally {
    clearTimeout(timer);
  }
}

// Many public RPCs cap getTransaction batches (publicnode allows 1), so the
// batch size adapts per endpoint after the first refusal.
const txBatchSize = new Map();

// Highest transaction version to request. Solana added v1 transactions; RPCs
// reject a transaction newer than the version a client asks for, and say
// which version to use, so we follow that hint per endpoint.
const txVersion = new Map();
const DEFAULT_TX_VERSION = 1;
const versionHint = (msg = "") => {
  const m = /maxSupportedTransactionVersion"?\s*:\s*(\d+)/i.exec(msg);
  return m ? Number(m[1]) : null;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isBatchLimit = (msg = "") => /batch/i.test(msg);

/**
 * Fetch many transactions. Adapts to batch limits, retries failures twice
 * with backoff, and reports what failed instead of silently dropping it.
 * Returns { results: Map<sig, tx|null>, errors: Error[] }.
 */
async function getTransactions(signatures) {
  const url = getSettings().solanaRpc;
  const opts = () => ({ encoding: "jsonParsed", maxSupportedTransactionVersion: txVersion.get(url) ?? DEFAULT_TX_VERSION, commitment: "confirmed" });
  // If the RPC names the version it wants, adopt it; the failed items get retried.
  const learnVersion = (msg) => {
    const v = versionHint(msg);
    if (v != null && v !== (txVersion.get(url) ?? DEFAULT_TX_VERSION)) txVersion.set(url, v);
  };
  const results = new Map();
  const errors = [];
  const rpcError = (e) => Object.assign(new Error(`Solana RPC: ${e?.message || "request refused"}`), { status: e?.code === 429 ? 429 : undefined });
  let pending = [...signatures];

  for (let attempt = 0; attempt < 3 && pending.length; attempt++) {
    if (attempt) await sleep(1500 * attempt);
    const failed = [];
    while (pending.length) {
      const size = txBatchSize.get(url) ?? 10;
      if (size > 1) {
        const group = pending.slice(0, size);
        try {
          const res = await solBatch(group.map((sig, i) => rpcBody(i, "getTransaction", [sig, opts()])));
          // Some RPCs answer an oversized batch with 200 and an error per item.
          if (res.some((r) => r.error && isBatchLimit(r.error.message))) {
            txBatchSize.set(url, 1);
            continue;
          }
          for (const r of res) {
            const sig = group[r.id];
            if (!sig) continue;
            if (r.error) {
              learnVersion(r.error.message);
              failed.push(sig);
              errors.push(rpcError(r.error));
            } else results.set(sig, r.result);
          }
          pending = pending.slice(size);
        } catch (err) {
          if (err.status === 400 || err.status === 413) {
            txBatchSize.set(url, 1);
            continue;
          }
          if (err.status !== 429 && err.name !== "AbortError" && !(err instanceof TypeError)) throw err;
          errors.push(err);
          failed.push(...group);
          pending = pending.slice(size);
        }
        continue;
      }
      // Single requests, four in flight.
      const group = pending.splice(0, 4);
      const res = await Promise.allSettled(group.map((sig) => solBatch([rpcBody(1, "getTransaction", [sig, opts()])])));
      res.forEach((r, i) => {
        const item = r.status === "fulfilled" ? r.value[0] : null;
        if (r.status === "rejected") {
          errors.push(r.reason);
          failed.push(group[i]);
        } else if (item?.error) {
          learnVersion(item.error.message);
          errors.push(rpcError(item.error));
          failed.push(group[i]);
        } else results.set(group[i], item?.result ?? null);
      });
    }
    pending = failed;
  }
  return { results, errors };
}

/** Turn one jsonParsed Solana transaction into an event for `owner`. */
export function parseSolanaTx(tx, owner, signature) {
  if (!tx?.meta) return null;
  const meta = tx.meta;
  const keys = (tx.transaction?.message?.accountKeys || []).map((k) => (typeof k === "string" ? k : k.pubkey));
  const idx = keys.indexOf(owner);
  const feePayer = keys[0] === owner;
  const fee = feePayer ? (meta.fee || 0) / 1e9 : 0;
  const deltas = new Map();
  const add = (mint, amt) => deltas.set(mint, (deltas.get(mint) || 0) + amt);

  if (idx >= 0) add(SOL_MINT, (meta.postBalances[idx] - meta.preBalances[idx]) / 1e9 + fee);
  const touched = new Set(); // every token the wallet's accounts handled, even at zero net
  const tokenSide = (list, sign) => {
    for (const b of list || []) {
      if (b.owner !== owner) continue;
      touched.add(b.mint);
      add(b.mint, sign * Number(b.uiTokenAmount?.uiAmountString ?? b.uiTokenAmount?.uiAmount ?? 0));
    }
  };
  tokenSide(meta.preTokenBalances, -1);
  tokenSide(meta.postTokenBalances, 1);

  let changes = [...deltas.entries()]
    .filter(([, amt]) => Math.abs(amt) > EPS)
    .map(([mint, amount]) => ({ key: `solana:${mint}`, chain: "solana", assetId: mint, amount }));
  // Token-account rent (~0.002 SOL) next to token moves is noise, not a trade leg.
  const sol = changes.find((c) => c.assetId === SOL_MINT);
  if (sol && Math.abs(sol.amount) < 0.0025 && changes.length > 1) changes = changes.filter((c) => c !== sol);

  const ok = !meta.err;
  if (!ok) changes = [];
  const dex = usesDex(tx);
  // Tokens the trade passed through, SOL first (arbs usually start and end there).
  const route = [...touched].sort((a, b) => (a === SOL_MINT ? -1 : b === SOL_MINT ? 1 : 0));
  return {
    dex,
    route: dex && route.length ? route : undefined,
    id: signature,
    time: (tx.blockTime || 0) * 1000,
    chain: "solana",
    ok,
    fee,
    feeKey: `solana:${SOL_MINT}`,
    changes,
    kind: classify(changes, ok, dex, route.length),
    url: `https://solscan.io/tx/${signature}`,
  };
}

async function fetchSolanaEvents(address, { newest, before, limit = 50 } = {}) {
  const range = before ? { before } : newest ? { until: newest } : {};
  const sigRes = await solBatch([rpcBody(1, "getSignaturesForAddress", [address, { limit, ...range }])]);
  // RPCs often refuse with HTTP 200 + a JSON error; don't mistake that for "no transactions".
  if (sigRes[0]?.error) {
    const err = new Error(`Solana RPC: ${sigRes[0].error.message || "request refused"}`);
    err.status = sigRes[0].error.code === 403 ? 403 : undefined;
    throw err;
  }
  const sigs = sigRes[0]?.result || [];
  const stats = { source: new URL(getSettings().solanaRpc).host, signatures: sigs.length, loaded: 0 };
  if (!sigs.length) return { events: [], stats };
  const { results, errors } = await getTransactions(sigs.map((s) => s.signature));
  const events = [];
  for (const s of sigs) {
    const ev = parseSolanaTx(results.get(s.signature), address, s.signature);
    if (ev) events.push(ev);
  }
  stats.loaded = events.length;
  // Signatures exist but no transaction could be read: that's a failure, not an empty wallet.
  if (!events.length && errors.length) throw errors[0];
  if (errors.length) stats.warning = `${sigs.length - events.length} of ${sigs.length} transactions failed to load (${errors[0].message}); retrying on next sync`;
  // Symbols and reference prices for tokens the wallet no longer holds.
  const mints = [...new Set(events.flatMap((e) => [...e.changes.map((c) => c.assetId), ...(e.route || [])]))];
  const [meta, prices] = await Promise.all([
    jupTokenMeta(mints).catch(() => ({})),
    jupPrices(mints.slice(0, 50)).catch(() => ({})),
  ]);
  for (const e of events) {
    for (const c of e.changes) {
      c.symbol = c.assetId === SOL_MINT ? "SOL" : meta[c.assetId]?.symbol || c.assetId.slice(0, 4);
      c.price = prices[c.assetId]?.usdPrice;
    }
    if (e.route) e.routeSymbols = e.route.map((m) => (m === SOL_MINT ? "SOL" : meta[m]?.symbol || m.slice(0, 4)));
  }
  return { events, stats };
}

/* ---------------------------------------------------------------- bitcoin */

export function parseBitcoinTx(t, address) {
  const out = (t.vout || []).filter((o) => o.scriptpubkey_address === address).reduce((s, o) => s + o.value, 0);
  const inp = (t.vin || []).filter((i) => i.prevout?.scriptpubkey_address === address).reduce((s, i) => s + i.prevout.value, 0);
  const fee = inp > 0 ? (t.fee || 0) / 1e8 : 0;
  const amount = (out - inp) / 1e8 + fee;
  const changes = Math.abs(amount) > EPS ? [{ key: "bitcoin:native", chain: "bitcoin", assetId: "native", symbol: "BTC", amount }] : [];
  return {
    id: t.txid,
    time: (t.status?.block_time || Date.now() / 1000) * 1000,
    chain: "bitcoin",
    ok: true,
    pending: !t.status?.confirmed,
    fee,
    feeKey: "bitcoin:native",
    changes,
    kind: classify(changes),
    url: `https://mempool.space/tx/${t.txid}`,
  };
}

async function fetchBitcoinEvents(address, { before } = {}) {
  const url = before
    ? `https://mempool.space/api/address/${address}/txs/chain/${before}`
    : `https://mempool.space/api/address/${address}/txs`;
  const txs = await getJson(url);
  const events = (txs || []).map((t) => parseBitcoinTx(t, address));
  return { events, stats: { source: "mempool.space", signatures: events.length, loaded: events.length } };
}

/* -------------------------------------------------------------------- evm */

const BLOCKSCOUT = {
  ethereum: { host: "https://eth.blockscout.com", symbol: "ETH" },
  base: { host: "https://base.blockscout.com", symbol: "ETH" },
  optimism: { host: "https://explorer.optimism.io", symbol: "ETH" },
  arbitrum: { host: "https://arbitrum.blockscout.com", symbol: "ETH" },
  polygon: { host: "https://polygon.blockscout.com", symbol: "POL" },
};

const big = (v, decimals) => {
  if (!v) return 0;
  const s = String(v).padStart(Number(decimals) + 1, "0");
  const cut = s.length - Number(decimals);
  return Number(`${s.slice(0, cut)}.${s.slice(cut)}`);
};

export function parseEvmActivity(chain, address, txs, transfers) {
  const me = address.toLowerCase();
  const cfg = BLOCKSCOUT[chain];
  const byHash = new Map();
  const get = (hash, time) => {
    if (!byHash.has(hash)) byHash.set(hash, { id: `${chain}:${hash}`, hash, time, chain, ok: true, fee: 0, feeKey: `${chain}:native`, deltas: new Map(), url: `${cfg.host}/tx/${hash}` });
    return byHash.get(hash);
  };
  const add = (ev, key, assetId, symbol, amount, price) => {
    const cur = ev.deltas.get(key) || { key, chain, assetId, symbol, amount: 0, price };
    cur.amount += amount;
    ev.deltas.set(key, cur);
  };
  for (const t of txs || []) {
    const ev = get(t.hash, Date.parse(t.timestamp));
    const from = t.from?.hash?.toLowerCase();
    const to = t.to?.hash?.toLowerCase();
    const value = big(t.value, 18);
    if (from === me) {
      ev.fee = big(t.fee?.value, 18);
      if (value) add(ev, `${chain}:native`, "native", cfg.symbol, -value);
    }
    if (to === me && value) add(ev, `${chain}:native`, "native", cfg.symbol, value);
    if (t.status && t.status !== "ok") ev.ok = false;
    if (/swap|route|multicall|execute|exactInput|exactOutput|arb/i.test(t.method || "")) ev.dex = true;
  }
  for (const tr of transfers || []) {
    if (tr.token_type && tr.token_type !== "ERC-20") continue;
    const ev = get(tr.transaction_hash, Date.parse(tr.timestamp));
    const amt = big(tr.total?.value, tr.total?.decimals ?? tr.token?.decimals ?? 18);
    const addr = (tr.token?.address_hash || tr.token?.address || "").toLowerCase();
    const price = tr.token?.exchange_rate ? Number(tr.token.exchange_rate) : undefined;
    if (tr.from?.hash?.toLowerCase() === me) add(ev, `${chain}:${addr}`, addr, tr.token?.symbol || "?", -amt, price);
    if (tr.to?.hash?.toLowerCase() === me) add(ev, `${chain}:${addr}`, addr, tr.token?.symbol || "?", amt, price);
  }
  return [...byHash.values()].map(({ deltas, hash, ...ev }) => {
    const changes = ev.ok ? [...deltas.values()].filter((c) => Math.abs(c.amount) > EPS) : [];
    return { ...ev, changes, kind: classify(changes, ev.ok, !!ev.dex) };
  });
}

async function fetchEvmEvents(address, chains) {
  const list = (chains?.length ? chains : Object.keys(BLOCKSCOUT)).filter((c) => BLOCKSCOUT[c]);
  const results = await Promise.allSettled(
    list.map(async (chain) => {
      const base = `${BLOCKSCOUT[chain].host}/api/v2/addresses/${address}`;
      const [txs, transfers] = await Promise.all([
        getJson(`${base}/transactions`).then((r) => r.items),
        getJson(`${base}/token-transfers?type=ERC-20`).then((r) => r.items).catch(() => []),
      ]);
      return parseEvmActivity(chain, address, txs, transfers);
    })
  );
  const ok = results.filter((r) => r.status === "fulfilled").flatMap((r) => r.value);
  if (!ok.length && results.every((r) => r.status === "rejected")) {
    throw new Error("No EVM explorer (Blockscout) reachable from this network");
  }
  const failedChains = list.filter((_, i) => results[i].status === "rejected");
  return {
    events: ok,
    stats: {
      source: "Blockscout",
      signatures: ok.length,
      loaded: ok.length,
      ...(failedChains.length ? { warning: `Explorer unreachable for: ${failedChains.join(", ")}` } : {}),
    },
  };
}

/* ------------------------------------------------------------------ entry */

/**
 * Fetch recent events for a wallet: { events, stats }. `newest` enables
 * incremental Solana sync. stats: { source, signatures, loaded, warning? }.
 */
export async function fetchEvents(wallet, opts = {}) {
  if (wallet.family === "solana") return fetchSolanaEvents(wallet.address, opts);
  if (wallet.family === "bitcoin") return fetchBitcoinEvents(wallet.address, opts);
  if (wallet.family === "evm") return fetchEvmEvents(wallet.address, wallet.chains);
  return { events: [], stats: {} };
}

/** Merge new events into a cached list (dedupe by id, newest first, capped). */
export function mergeEvents(cached = [], fresh = [], cap = 2000) {
  const map = new Map(cached.map((e) => [e.id, e]));
  for (const e of fresh) map.set(e.id, e);
  return [...map.values()].sort((a, b) => b.time - a.time).slice(0, cap);
}

/** USD value of a change, preferring the live portfolio price. */
export const changeUsd = (c, priceOf) => c.amount * (priceOf(c.key) ?? c.price ?? 0);

/**
 * Rebuild a value-over-time step line from events, walking back from the
 * current total. mode "trades" only moves the line on swaps; "activity"
 * applies every balance change and fee. Values use current prices.
 */
export function reconstructSeries(events, { total, priceOf, mode = "activity", now = Date.now() }) {
  const pts = [{ x: now, y: total }];
  let v = total;
  for (const e of [...events].sort((a, b) => b.time - a.time)) {
    if (mode === "trades" && !isTrade(e) && !isFailedTrade(e)) continue;
    let dv = e.changes.reduce((s, c) => s + changeUsd(c, priceOf), 0);
    if (e.fee) dv -= e.fee * (priceOf(e.feeKey) ?? 0);
    if (Math.abs(dv) < 1e-9 && mode === "trades") continue;
    pts.push({ x: e.time, y: v, event: e });
    v -= dv;
    pts.push({ x: e.time - 1, y: v, event: e });
  }
  return pts.reverse();
}
