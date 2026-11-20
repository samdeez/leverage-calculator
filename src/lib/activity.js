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
  receive: { label: "RECEIVE", tone: "pos" },
  send: { label: "SEND", tone: "neg" },
  other: { label: "OTHER", tone: "" },
  failed: { label: "FAILED", tone: "warn" },
};

/** Classify by the signs of the balance changes. */
export function classify(changes, ok = true) {
  if (!ok) return "failed";
  const pos = changes.some((c) => c.amount > 0);
  const neg = changes.some((c) => c.amount < 0);
  if (pos && neg) return "swap";
  if (neg) return "send";
  if (pos) return "receive";
  return "other";
}

const EPS = 1e-9;
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isBatchLimit = (msg = "") => /batch/i.test(msg);

/**
 * Fetch many transactions. Adapts to batch limits, retries failures twice
 * with backoff, and reports what failed instead of silently dropping it.
 * Returns { results: Map<sig, tx|null>, errors: Error[] }.
 */
async function getTransactions(signatures) {
  const url = getSettings().solanaRpc;
  const opts = { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" };
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
          const res = await solBatch(group.map((sig, i) => rpcBody(i, "getTransaction", [sig, opts])));
          // Some RPCs answer an oversized batch with 200 and an error per item.
          if (res.some((r) => r.error && isBatchLimit(r.error.message))) {
            txBatchSize.set(url, 1);
            continue;
          }
          for (const r of res) {
            const sig = group[r.id];
            if (!sig) continue;
            if (r.error) {
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
      const res = await Promise.allSettled(group.map((sig) => solBatch([rpcBody(1, "getTransaction", [sig, opts])])));
      res.forEach((r, i) => {
        const item = r.status === "fulfilled" ? r.value[0] : null;
        if (r.status === "rejected") {
          errors.push(r.reason);
          failed.push(group[i]);
        } else if (item?.error) {
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
  const tokenSide = (list, sign) => {
    for (const b of list || []) {
      if (b.owner !== owner) continue;
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
  return {
    id: signature,
    time: (tx.blockTime || 0) * 1000,
    chain: "solana",
    ok,
    fee,
    feeKey: `solana:${SOL_MINT}`,
    changes,
    kind: classify(changes, ok),
    url: `https://solscan.io/tx/${signature}`,
  };
}

async function fetchSolanaEvents(address, { newest, limit = 40 } = {}) {
  const sigRes = await solBatch([rpcBody(1, "getSignaturesForAddress", [address, { limit, ...(newest ? { until: newest } : {}) }])]);
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
  const mints = [...new Set(events.flatMap((e) => e.changes.map((c) => c.assetId)))];
  const [meta, prices] = await Promise.all([
    jupTokenMeta(mints).catch(() => ({})),
    jupPrices(mints.slice(0, 50)).catch(() => ({})),
  ]);
  for (const e of events) {
    for (const c of e.changes) {
      c.symbol = c.assetId === SOL_MINT ? "SOL" : meta[c.assetId]?.symbol || c.assetId.slice(0, 4);
      c.price = prices[c.assetId]?.usdPrice;
    }
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

async function fetchBitcoinEvents(address) {
  const txs = await getJson(`https://mempool.space/api/address/${address}/txs`);
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
    return { ...ev, changes, kind: classify(changes, ev.ok) };
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
  if (wallet.family === "bitcoin") return fetchBitcoinEvents(wallet.address);
  if (wallet.family === "evm") return fetchEvmEvents(wallet.address, wallet.chains);
  return { events: [], stats: {} };
}

/** Merge new events into a cached list (dedupe by id, newest first, capped). */
export function mergeEvents(cached = [], fresh = [], cap = 300) {
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
    if (mode === "trades" && e.kind !== "swap") continue;
    let dv = e.changes.reduce((s, c) => s + changeUsd(c, priceOf), 0);
    if (mode === "activity" && e.fee) dv -= e.fee * (priceOf(e.feeKey) ?? 0);
    if (Math.abs(dv) < 1e-9 && mode === "trades") continue;
    pts.push({ x: e.time, y: v, event: e });
    v -= dv;
    pts.push({ x: e.time - 1, y: v, event: e });
  }
  return pts.reverse();
}
