// Solana: balances over JSON-RPC, live updates over the RPC WebSocket.
import { getJson } from "../http";
import { getSettings, solanaWsUrl } from "../settingsStore";
import { SOL_MINT, jupHoldings, jupPrices, jupTokenMeta } from "../jupiter";

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

let rpcId = 0;
export async function solRpc(method, params) {
  const res = await getJson(getSettings().solanaRpc, {
    method: "POST",
    body: { jsonrpc: "2.0", id: ++rpcId, method, params },
  });
  if (res.error) throw new Error(res.error.message || "RPC error");
  return res.result;
}

const parsedOpts = { encoding: "jsonParsed", commitment: "confirmed" };

async function rpcTokenBalances(address) {
  const [t1, t2] = await Promise.all([
    solRpc("getTokenAccountsByOwner", [address, { programId: TOKEN_PROGRAM }, parsedOpts]),
    solRpc("getTokenAccountsByOwner", [address, { programId: TOKEN_2022 }, parsedOpts]).catch(() => ({ value: [] })),
  ]);
  const tokens = {};
  for (const acc of [...(t1?.value || []), ...(t2?.value || [])]) {
    const info = acc.account?.data?.parsed?.info;
    const amt = info?.tokenAmount;
    if (!info || !amt) continue;
    const ui = Number(amt.uiAmountString ?? amt.uiAmount ?? 0);
    if (ui > 0) tokens[info.mint] = (tokens[info.mint] || 0) + ui;
  }
  return tokens;
}

/**
 * Raw balances: { lamports, tokens: { [mint]: uiAmount }, source }.
 * Token accounts come from the RPC when it allows it; free public RPCs block
 * getTokenAccountsByOwner, so we fall back to Jupiter's holdings endpoint.
 */
const blockedUntil = new Map(); // rpc url -> time until we retry token queries on it

export async function fetchSolanaBalances(address) {
  const url = getSettings().solanaRpc;
  const skipRpc = (blockedUntil.get(url) || 0) > Date.now();
  const [bal, tokens] = await Promise.allSettled([
    solRpc("getBalance", [address, { commitment: "confirmed" }]),
    skipRpc ? Promise.reject(new Error("skipped")) : rpcTokenBalances(address),
  ]);
  if (tokens.status === "rejected" && !skipRpc) blockedUntil.set(url, Date.now() + 10 * 60000);
  if (bal.status === "fulfilled" && tokens.status === "fulfilled") {
    return { lamports: bal.value?.value ?? 0, tokens: tokens.value, source: "rpc" };
  }
  const jup = await jupHoldings(address);
  return {
    lamports: bal.status === "fulfilled" ? bal.value?.value ?? jup.lamports : jup.lamports,
    tokens: jup.tokens,
    source: "jupiter",
  };
}

/** Full Solana wallet → normalized holdings with prices & metadata. */
export async function fetchSolanaWallet(address) {
  const { lamports, tokens, source } = await fetchSolanaBalances(address);
  const amounts = { ...tokens, [SOL_MINT]: (tokens[SOL_MINT] || 0) + lamports / 1e9 };
  const mints = Object.keys(amounts);
  const [prices, meta] = await Promise.all([
    jupPrices(mints).catch(() => ({})),
    jupTokenMeta(mints).catch(() => ({})),
  ]);
  const holdings = mints.map((mint) => {
    const p = prices[mint];
    const m = meta[mint] || {};
    const isSol = mint === SOL_MINT;
    const price = p?.usdPrice ?? 0;
    return {
      id: `solana:${mint}`,
      chain: "solana",
      assetId: mint,
      symbol: isSol ? "SOL" : m.symbol || mint.slice(0, 4),
      name: isSol ? "Solana" : m.name || "Unknown token",
      icon: m.icon,
      verified: isSol || !!m.verified,
      priced: !!p,
      amount: amounts[mint],
      price,
      value: amounts[mint] * price,
      change24h: p?.priceChange24h ?? null,
      liveSymbol: isSol ? "SOL" : undefined,
    };
  });
  return { holdings, lamports, source };
}

export async function fetchSolanaActivity(address, limit = 15) {
  const sigs = await solRpc("getSignaturesForAddress", [address, { limit }]);
  return (sigs || []).map((s) => ({
    id: s.signature,
    time: (s.blockTime || 0) * 1000,
    ok: !s.err,
    memo: s.memo,
    url: `https://solscan.io/tx/${s.signature}`,
  }));
}

/**
 * One shared RPC WebSocket for all Solana wallets.
 * - accountSubscribe: SOL balance changes arrive instantly
 * - logsSubscribe (mentions): any transaction touching the wallet → token refresh
 */
class SolanaSocket {
  ws = null;
  url = "";
  nextId = 1;
  pending = new Map(); // request id -> { key }
  subs = new Map(); // key -> { method, params, cb, subId }
  bySubId = new Map();
  statusCb = new Set();
  status = "idle";
  retry = 0;
  keepAlive = null;

  setStatus(s) {
    this.status = s;
    this.statusCb.forEach((cb) => cb(s));
  }

  onStatus(cb) {
    this.statusCb.add(cb);
    cb(this.status);
    return () => this.statusCb.delete(cb);
  }

  watchWallet(address, { onLamports, onActivity }) {
    const k1 = `acct:${address}`;
    const k2 = `logs:${address}`;
    this.add(k1, "accountSubscribe", [address, { commitment: "confirmed", encoding: "base64" }], (v) =>
      onLamports(v?.value?.lamports ?? v?.lamports)
    );
    this.add(k2, "logsSubscribe", [{ mentions: [address] }, { commitment: "confirmed" }], (v) =>
      onActivity(v?.value?.signature)
    );
    return () => {
      this.remove(k1);
      this.remove(k2);
    };
  }

  add(key, method, params, cb) {
    this.subs.set(key, { method, params, cb, subId: null });
    this.connect();
    this.request(key);
  }

  remove(key) {
    const sub = this.subs.get(key);
    if (!sub) return;
    this.subs.delete(key);
    if (sub.subId != null) {
      this.bySubId.delete(sub.subId);
      const un = sub.method.replace("Subscribe", "Unsubscribe");
      this.raw({ jsonrpc: "2.0", id: this.nextId++, method: un, params: [sub.subId] });
    }
    if (!this.subs.size) this.close();
  }

  request(key) {
    const sub = this.subs.get(key);
    if (!sub || !this.ws || this.ws.readyState !== 1) return;
    const id = this.nextId++;
    this.pending.set(id, key);
    this.raw({ jsonrpc: "2.0", id, method: sub.method, params: sub.params });
  }

  raw(msg) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  connect() {
    const url = solanaWsUrl();
    if (this.ws && this.url === url) return;
    if (this.ws) this.close(true);
    if (typeof WebSocket === "undefined") return;
    this.url = url;
    this.setStatus("connecting");
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.setStatus("live");
      for (const key of this.subs.keys()) this.request(key);
      // Some providers drop idle sockets; a cheap ping keeps it open.
      this.keepAlive = setInterval(() => this.raw({ jsonrpc: "2.0", id: 0, method: "ping" }), 30000);
    };
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.id != null && this.pending.has(msg.id)) {
        const key = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        const sub = this.subs.get(key);
        if (sub && typeof msg.result === "number") {
          sub.subId = msg.result;
          this.bySubId.set(msg.result, key);
        }
        return;
      }
      const subId = msg.params?.subscription;
      if (subId == null) return;
      const key = this.bySubId.get(subId);
      this.subs.get(key)?.cb(msg.params.result);
    };
    ws.onclose = () => {
      clearInterval(this.keepAlive);
      if (this.ws !== ws) return;
      this.ws = null;
      this.bySubId.clear();
      this.pending.clear();
      for (const s of this.subs.values()) s.subId = null;
      if (!this.subs.size) return this.setStatus("idle");
      this.setStatus("reconnecting");
      setTimeout(() => this.connect(), Math.min(20000, 1000 * 2 ** this.retry++));
    };
    ws.onerror = () => ws.close();
  }

  close(keepSubs = false) {
    const ws = this.ws;
    this.ws = null;
    clearInterval(this.keepAlive);
    if (ws) {
      ws.onclose = ws.onmessage = ws.onerror = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
    if (!keepSubs) this.setStatus("idle");
  }

  /** Reconnect after the RPC endpoint changes. */
  restart() {
    this.close(true);
    if (this.subs.size) this.connect();
  }
}

export const solanaSocket = new SolanaSocket();

/** Resolve a .sol domain via the public Bonfida SNS proxy. */
export async function resolveSolDomain(name) {
  const res = await getJson(`https://sns-sdk-proxy.bonfida.workers.dev/resolve/${encodeURIComponent(name.replace(/\.sol$/i, ""))}`);
  if (res?.s !== "ok" || !res.result) throw new Error(`Could not resolve ${name}`);
  return res.result;
}
