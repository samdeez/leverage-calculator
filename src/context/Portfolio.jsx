// Portfolio engine: lives at the app root so live updates and history
// snapshots keep running whichever tab is open.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLivePrices } from "../hooks/useLivePrice";
import { fetchWallet } from "../lib/chains";
import { solanaSocket } from "../lib/chains/solana";
import { addSnapshot } from "../lib/history";
import { createIdbStore, uid } from "../lib/idbStore";
import { SOL_MINT } from "../lib/jupiter";
import { getSettings, useSettings } from "../lib/settingsStore";

export const walletsStore = createIdbStore("wallets.v1", []);
export const cacheStore = createIdbStore("walletCache.v1", {});
export const historyStore = createIdbStore("history.v1", []);

const Ctx = createContext(null);

export function PortfolioProvider({ children }) {
  const wallets = walletsStore.use();
  const cache = cacheStore.use();
  const history = historyStore.use();
  const settings = useSettings();
  const [refreshing, setRefreshing] = useState(() => new Set());
  const [solStatus, setSolStatus] = useState("idle");
  const [flash, setFlash] = useState({}); // walletId -> "up" | "down"
  const inflight = useRef(new Map());

  const markRefreshing = (id, on) =>
    setRefreshing((cur) => {
      const next = new Set(cur);
      on ? next.add(id) : next.delete(id);
      return next;
    });

  const pulse = useCallback((id, dir) => {
    setFlash((f) => ({ ...f, [id]: dir }));
    setTimeout(() => setFlash((f) => (f[id] === dir ? { ...f, [id]: null } : f)), 900);
  }, []);

  const refreshWallet = useCallback(
    (wallet) => {
      if (inflight.current.has(wallet.id)) return inflight.current.get(wallet.id);
      markRefreshing(wallet.id, true);
      const p = fetchWallet(wallet)
        .then((res) => {
          cacheStore.set((c) => {
            const prevTotal = (c[wallet.id]?.holdings || []).reduce((s, h) => s + h.value, 0);
            const total = res.holdings.reduce((s, h) => s + h.value, 0);
            if (prevTotal && Math.abs(total - prevTotal) > 0.005) pulse(wallet.id, total > prevTotal ? "up" : "down");
            return {
              ...c,
              [wallet.id]: { holdings: res.holdings, lamports: res.lamports, source: res.source, warnings: res.warnings, fetchedAt: Date.now(), error: null },
            };
          });
        })
        .catch((err) => {
          cacheStore.set((c) => ({ ...c, [wallet.id]: { ...(c[wallet.id] || { holdings: [] }), error: err.message || String(err), failedAt: Date.now() } }));
        })
        .finally(() => {
          inflight.current.delete(wallet.id);
          markRefreshing(wallet.id, false);
        });
      inflight.current.set(wallet.id, p);
      return p;
    },
    [pulse]
  );

  const refreshAll = useCallback(async () => {
    const list = walletsStore.get();
    // Two at a time keeps public RPCs and the keyless Jupiter limit happy.
    const queue = [...list];
    const worker = async () => {
      while (queue.length) await refreshWallet(queue.shift());
    };
    await Promise.all([worker(), worker()]);
  }, [refreshWallet]);

  /* --------------------------------------------------- wallet management */

  const addWallet = useCallback(
    (w) => {
      const wallet = { id: uid(), addedAt: Date.now(), hidden: false, ...w };
      walletsStore.set((list) => [...list, wallet]);
      refreshWallet(wallet);
      return wallet;
    },
    [refreshWallet]
  );

  const updateWallet = useCallback((id, patch) => walletsStore.set((list) => list.map((w) => (w.id === id ? { ...w, ...patch } : w))), []);

  const removeWallet = useCallback((id) => {
    walletsStore.set((list) => list.filter((w) => w.id !== id));
    cacheStore.set((c) => {
      const { [id]: _drop, ...rest } = c;
      return rest;
    });
  }, []);

  const moveWallet = useCallback((id, dir) => {
    walletsStore.set((list) => {
      const i = list.findIndex((w) => w.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = list.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  /* ----------------------------------------------------- initial + polling */

  const walletKey = wallets.map((w) => w.id).join(",");
  useEffect(() => {
    let alive = true;
    Promise.all([walletsStore.ready, cacheStore.ready]).then(() => {
      if (!alive) return;
      // Refresh anything whose cache is older than the poll interval.
      const maxAge = getSettings().refreshSec * 1000;
      walletsStore.get().forEach((w) => {
        const c = cacheStore.get()[w.id];
        if (!c?.fetchedAt || Date.now() - c.fetchedAt > maxAge) refreshWallet(w);
      });
    });
    return () => {
      alive = false;
    };
  }, [walletKey, refreshWallet]);

  useEffect(() => {
    const ms = Math.max(10, Number(settings.refreshSec) || 30) * 1000;
    const id = setInterval(() => {
      if (document.visibilityState !== "hidden") refreshAll();
    }, ms);
    return () => clearInterval(id);
  }, [settings.refreshSec, refreshAll]);

  /* ------------------------------------------------- Solana live websocket */

  useEffect(() => solanaSocket.onStatus(setSolStatus), []);
  useEffect(() => {
    solanaSocket.restart();
  }, [settings.solanaRpc, settings.solanaWs]);

  const solKey = wallets
    .filter((w) => w.family === "solana")
    .map((w) => `${w.id}:${w.address}`)
    .join(",");
  useEffect(() => {
    const timers = {};
    const unsubs = walletsStore
      .get()
      .filter((w) => w.family === "solana")
      .map((w) =>
        solanaSocket.watchWallet(w.address, {
          // SOL balance changes are applied instantly, no refetch needed.
          onLamports: (lamports) => {
            if (typeof lamports !== "number") return;
            cacheStore.set((c) => {
              const entry = c[w.id];
              if (!entry || entry.lamports == null || entry.lamports === lamports) return c;
              const delta = (lamports - entry.lamports) / 1e9;
              pulse(w.id, delta > 0 ? "up" : "down");
              const holdings = entry.holdings.map((h) =>
                h.assetId === SOL_MINT ? { ...h, amount: h.amount + delta, value: (h.amount + delta) * h.price } : h
              );
              return { ...c, [w.id]: { ...entry, lamports, holdings, fetchedAt: Date.now() } };
            });
          },
          // Any transaction mentioning the wallet → refetch token balances (debounced).
          onActivity: () => {
            clearTimeout(timers[w.id]);
            timers[w.id] = setTimeout(() => refreshWallet(w), 1500);
          },
        })
      );
    return () => {
      unsubs.forEach((u) => u());
      Object.values(timers).forEach(clearTimeout);
    };
  }, [solKey, refreshWallet, pulse]);

  /* ------------------------------------------- live prices for majors */

  const liveSymbols = useMemo(() => {
    const set = new Set();
    for (const c of Object.values(cache)) for (const h of c.holdings || []) if (h.liveSymbol) set.add(h.liveSymbol);
    return [...set];
  }, [cache]);
  const ticks = useLivePrices(liveSymbols);

  /* ---------------------------------------------------- derived values */

  const byWallet = useMemo(() => {
    const out = {};
    for (const w of wallets) {
      const entry = cache[w.id];
      const holdings = (entry?.holdings || []).map((h) => {
        const t = h.liveSymbol && ticks[h.liveSymbol];
        if (!t?.price) return h;
        return { ...h, price: t.price, value: h.amount * t.price, change24h: t.change ?? h.change24h, live: true };
      });
      holdings.sort((a, b) => b.value - a.value);
      const total = holdings.reduce((s, h) => s + h.value, 0);
      const change = holdings.reduce((s, h) => (h.change24h != null ? s + (h.value * h.change24h) / (100 + h.change24h) : s), 0);
      out[w.id] = { ...entry, holdings, total, change };
    }
    return out;
  }, [wallets, cache, ticks]);

  const summary = useMemo(() => {
    const assets = new Map();
    let total = 0;
    let change = 0;
    const chains = {};
    for (const w of wallets) {
      if (w.hidden) continue;
      const wv = byWallet[w.id];
      if (!wv) continue;
      total += wv.total;
      change += wv.change;
      for (const h of wv.holdings) {
        chains[h.chain] = (chains[h.chain] || 0) + h.value;
        const cur = assets.get(h.id);
        if (cur) {
          cur.amount += h.amount;
          cur.value += h.value;
          cur.wallets.push(w.id);
        } else assets.set(h.id, { ...h, wallets: [w.id] });
      }
    }
    const list = [...assets.values()].sort((a, b) => b.value - a.value);
    return { total, change, changePct: total - change ? (change / (total - change)) * 100 : 0, assets: list, chains };
  }, [wallets, byWallet]);

  /* ----------------------------------------------------- history snapshots */

  const summaryRef = useRef(summary);
  summaryRef.current = summary;
  const byWalletRef = useRef(byWallet);
  byWalletRef.current = byWallet;

  const takeSnapshot = useCallback(() => {
    const list = walletsStore.get();
    if (!list.length) return;
    const c = cacheStore.get();
    // Only record once every wallet has data, so totals never dip to zero.
    if (!list.every((w) => c[w.id]?.fetchedAt)) return;
    const walletsVals = Object.fromEntries(list.map((w) => [w.id, byWalletRef.current[w.id]?.total ?? 0]));
    const snap = { t: Date.now(), total: summaryRef.current.total, wallets: walletsVals };
    historyStore.set((h) => addSnapshot(h, snap, Math.max(1, Number(getSettings().snapshotMin) || 5) * 60000));
  }, []);

  useEffect(() => {
    const id = setInterval(takeSnapshot, 30000);
    const first = setTimeout(takeSnapshot, 4000);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, [takeSnapshot]);

  // Snapshot right after a refresh round completes.
  const wasRefreshing = useRef(false);
  useEffect(() => {
    if (wasRefreshing.current && refreshing.size === 0) takeSnapshot();
    wasRefreshing.current = refreshing.size > 0;
  }, [refreshing, takeSnapshot]);

  const value = {
    wallets,
    cache,
    byWallet,
    summary,
    history,
    refreshing,
    flash,
    solStatus,
    refreshAll,
    refreshWallet,
    addWallet,
    updateWallet,
    removeWallet,
    moveWallet,
    clearHistory: () => historyStore.set([]),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePortfolio = () => useContext(Ctx);
