// Real-time price feed shared by the whole app.
// Streams ticks over a public exchange WebSocket (Coinbase, then OKX as a
// fallback) and polls Jupiter / CoinGecko for any symbol that has not ticked
// recently, so prices keep flowing even where an exchange is geo-blocked.
import { getJson } from "./http";
import { getSettings } from "./settingsStore";
import { jupPrices } from "./jupiter";

export const ASSETS = {
  SOL: { cb: "SOL-USD", okx: "SOL-USDT", mint: "So11111111111111111111111111111111111111112", cg: "solana" },
  BTC: { cb: "BTC-USD", okx: "BTC-USDT", cg: "bitcoin" },
  ETH: { cb: "ETH-USD", okx: "ETH-USDT", cg: "ethereum" },
  JUP: { cb: "JUP-USD", okx: "JUP-USDT", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", cg: "jupiter-exchange-solana" },
  BONK: { cb: "BONK-USD", okx: "BONK-USDT", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", cg: "bonk" },
  WIF: { cb: "WIF-USD", okx: "WIF-USDT", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", cg: "dogwifcoin" },
  JTO: { cb: "JTO-USD", okx: "JTO-USDT", mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", cg: "jito-governance-token" },
  PYTH: { cb: "PYTH-USD", okx: "PYTH-USDT", mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", cg: "pyth-network" },
  RAY: { okx: "RAY-USDT", mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", cg: "raydium" },
  BNB: { okx: "BNB-USDT", cg: "binancecoin" },
  AVAX: { cb: "AVAX-USD", okx: "AVAX-USDT", cg: "avalanche-2" },
  POL: { cb: "POL-USD", okx: "POL-USDT", cg: "polygon-ecosystem-token" },
  ARB: { cb: "ARB-USD", okx: "ARB-USDT", cg: "arbitrum" },
  OP: { cb: "OP-USD", okx: "OP-USDT", cg: "optimism" },
};

export const ASSET_SYMBOLS = Object.keys(ASSETS);

const PROVIDERS = {
  coinbase: {
    url: "wss://ws-feed.exchange.coinbase.com",
    id: (s) => ASSETS[s]?.cb,
    sub: (ids) => ({ type: "subscribe", product_ids: ids, channels: ["ticker"] }),
    unsub: (ids) => ({ type: "unsubscribe", product_ids: ids, channels: ["ticker"] }),
    parse(msg) {
      if (msg.type !== "ticker") return null;
      return [{ id: msg.product_id, price: +msg.price, open: +msg.open_24h }];
    },
  },
  okx: {
    url: "wss://ws.okx.com:8443/ws/v5/public",
    id: (s) => ASSETS[s]?.okx,
    sub: (ids) => ({ op: "subscribe", args: ids.map((instId) => ({ channel: "tickers", instId })) }),
    unsub: (ids) => ({ op: "unsubscribe", args: ids.map((instId) => ({ channel: "tickers", instId })) }),
    ping: "ping",
    parse(msg) {
      if (msg.arg?.channel !== "tickers" || !msg.data) return null;
      return msg.data.map((d) => ({ id: d.instId, price: +d.last, open: +d.open24h }));
    },
  },
};

class LiveFeed {
  subs = new Map(); // symbol -> Set<cb>
  last = new Map(); // symbol -> tick
  pending = new Set();
  statusListeners = new Set();
  status = "idle";
  ws = null;
  providerIdx = 0;
  gotData = false;
  flushTimer = null;
  pollTimer = null;
  retry = 0;

  providers() {
    const src = getSettings().priceSource;
    if (src === "poll") return [];
    if (src === "coinbase" || src === "okx") return [src];
    return ["coinbase", "okx"];
  }

  get provider() {
    return PROVIDERS[this.providers()[this.providerIdx]];
  }

  setStatus(s) {
    if (this.status === s) return;
    this.status = s;
    this.statusListeners.forEach((l) => l(s));
  }

  onStatus(cb) {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  get(symbol) {
    return this.last.get(symbol);
  }

  subscribe(symbol, cb) {
    symbol = String(symbol || "").toUpperCase();
    if (!ASSETS[symbol]) return () => {};
    let set = this.subs.get(symbol);
    const isNew = !set;
    if (!set) this.subs.set(symbol, (set = new Set()));
    set.add(cb);
    if (this.last.has(symbol)) cb(this.last.get(symbol));
    if (isNew) {
      this.ensureSocket();
      this.send("sub", [symbol]);
      this.ensurePolling();
      // Give the stream a moment before spending a rate-limited poll on it.
      setTimeout(() => {
        if (this.subs.has(symbol) && !this.last.has(symbol)) this.pollNow([symbol]);
      }, 3000);
    }
    return () => {
      set.delete(cb);
      if (!set.size) {
        this.subs.delete(symbol);
        this.send("unsub", [symbol]);
        if (!this.subs.size) this.shutdown();
      }
    };
  }

  /** Restart with the current settings (e.g. after the price source changes). */
  restart() {
    this.providerIdx = 0;
    this.closeSocket();
    if (this.subs.size) {
      this.ensureSocket();
      this.ensurePolling();
    }
  }

  send(kind, symbols) {
    const p = this.provider;
    if (!p || !this.ws || this.ws.readyState !== 1) return;
    const ids = symbols.map(p.id).filter(Boolean);
    if (ids.length) this.ws.send(JSON.stringify(kind === "sub" ? p.sub(ids) : p.unsub(ids)));
  }

  ensureSocket() {
    if (this.ws || typeof WebSocket === "undefined") return;
    const p = this.provider;
    if (!p) {
      this.setStatus("polling");
      return;
    }
    this.setStatus("connecting");
    this.gotData = false;
    let ws;
    try {
      ws = new WebSocket(p.url);
    } catch {
      this.nextProvider();
      return;
    }
    this.ws = ws;
    const watchdog = setTimeout(() => {
      if (!this.gotData && this.ws === ws) this.nextProvider();
    }, 7000);
    let pinger = null;
    ws.onopen = () => {
      this.send("sub", [...this.subs.keys()]);
      if (p.ping) pinger = setInterval(() => ws.readyState === 1 && ws.send(p.ping), 20000);
    };
    ws.onmessage = (ev) => {
      if (ev.data === "pong") return;
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      const ticks = p.parse(msg);
      if (!ticks) return;
      for (const t of ticks) {
        const symbol = ASSET_SYMBOLS.find((s) => p.id(s) === t.id);
        if (symbol && t.price) this.push(symbol, t.price, t.open ? ((t.price - t.open) / t.open) * 100 : null, "stream");
      }
      if (!this.gotData) {
        this.gotData = true;
        this.retry = 0;
        this.setStatus("live");
      }
    };
    ws.onclose = () => {
      clearTimeout(watchdog);
      clearInterval(pinger);
      if (this.ws !== ws) return;
      this.ws = null;
      if (!this.subs.size) return;
      if (!this.gotData) return this.nextProvider();
      this.setStatus("connecting");
      const delay = Math.min(15000, 500 * 2 ** this.retry++);
      setTimeout(() => this.ensureSocket(), delay);
    };
    ws.onerror = () => ws.close();
  }

  nextProvider() {
    this.closeSocket();
    this.providerIdx += 1;
    if (this.providerIdx >= this.providers().length) {
      this.setStatus("polling");
      // Try the streams again later; polling keeps prices fresh meanwhile.
      setTimeout(() => {
        if (this.subs.size && !this.ws && this.status === "polling") {
          this.providerIdx = 0;
          this.ensureSocket();
        }
      }, 60000);
      return;
    }
    this.ensureSocket();
  }

  closeSocket() {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = ws.onmessage = ws.onerror = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  }

  shutdown() {
    this.closeSocket();
    clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.setStatus("idle");
  }

  push(symbol, price, change, source) {
    const prev = this.last.get(symbol);
    this.last.set(symbol, {
      symbol,
      price,
      change: change ?? prev?.change ?? null,
      prev: prev?.price ?? price,
      ts: Date.now(),
      source,
    });
    this.pending.add(symbol);
    if (!this.flushTimer) {
      // Coalesce bursts of ticks into ~12 UI updates per second.
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        const syms = [...this.pending];
        this.pending.clear();
        for (const s of syms) this.subs.get(s)?.forEach((cb) => cb(this.last.get(s)));
      }, 80);
    }
  }

  ensurePolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      const stale = [...this.subs.keys()].filter((s) => {
        const t = this.last.get(s);
        return !t || Date.now() - t.ts > 8000;
      });
      if (stale.length) this.pollNow(stale);
    }, 5000);
  }

  async pollNow(symbols) {
    const withMint = symbols.filter((s) => ASSETS[s].mint);
    const rest = symbols.filter((s) => !ASSETS[s].mint);
    if (withMint.length) {
      try {
        const res = await jupPrices(withMint.map((s) => ASSETS[s].mint));
        for (const s of withMint) {
          const p = res[ASSETS[s].mint];
          if (p && !this.fresh(s)) this.push(s, p.usdPrice, p.priceChange24h, "jupiter");
        }
      } catch {
        rest.push(...withMint);
      }
    }
    if (rest.length) {
      try {
        const ids = rest.map((s) => ASSETS[s].cg).join(",");
        const res = await getJson(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
        );
        for (const s of rest) {
          const p = res[ASSETS[s].cg];
          if (p && !this.fresh(s)) this.push(s, p.usd, p.usd_24h_change, "coingecko");
        }
      } catch {
        /* offline: keep last known price */
      }
    }
  }

  fresh(symbol) {
    const t = this.last.get(symbol);
    return t && t.source === "stream" && Date.now() - t.ts < 8000;
  }
}

export const liveFeed = new LiveFeed();
