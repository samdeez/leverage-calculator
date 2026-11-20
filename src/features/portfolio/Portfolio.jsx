import React, { useEffect, useMemo, useRef, useState } from "react";
import Donut, { toSlices } from "../../components/charts/Donut";
import Sparkline from "../../components/charts/Sparkline";
import { Card, Kbd, Private, Segmented, StatusDot } from "../../components/ui";
import { usePortfolio } from "../../context/Portfolio";
import { useToast } from "../../context/Toast";
import { useHotkeys } from "../../hooks/useHotkeys";
import { useFeedStatus } from "../../hooks/useLivePrice";
import { usePersistentState } from "../../hooks/usePersistentState";
import { CHAIN_FAMILIES, CHAIN_NAMES, fetchActivity } from "../../lib/chains";
import { EVM_CHAINS } from "../../lib/chains/evm";
import { fmtPct, fmtPrice, fmtToken, fmtUsd, shortAddr, signClass, timeAgo } from "../../lib/format";
import { RANGES } from "../../lib/history";
import { ASSETS } from "../../lib/live";
import { useSettings } from "../../lib/settingsStore";
import AddWallet from "./AddWallet";
import HistoryCard from "./HistoryCard";

const RANGE_KEYS = Object.keys(RANGES);

export default function Portfolio({ active, openInCalculator }) {
  const p = usePortfolio();
  const settings = useSettings();
  const feed = useFeedStatus();
  const toast = useToast();
  const [view, setView] = usePersistentState("levcal:portfolio.view.v1", {
    range: "1W",
    walletId: "",
    alloc: "asset",
    sort: "value",
    hideDust: true,
  });
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const addRef = useRef(null);
  const searchRef = useRef(null);
  const [, forceTick] = useState(0);

  // Re-render "updated Xs ago" labels.
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => forceTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, [active]);

  const patchView = (patch) => setView((v) => ({ ...v, ...patch }));
  const selected = p.wallets.find((w) => w.id === view.walletId) || null;
  const noWallets = p.wallets.length === 0;

  useEffect(() => {
    if ((showAdd || noWallets) && active) addRef.current?.focus();
  }, [showAdd, noWallets, active]);

  useHotkeys(
    "Portfolio",
    [
      { id: "add", keys: ["a"], label: "Add wallet", run: () => setShowAdd(true) },
      { id: "refresh", keys: ["u"], label: "Refresh all wallets", run: () => { p.refreshAll(); toast("Refreshing wallets…"); } },
      { id: "search", keys: ["f", "/"], label: "Search holdings", run: () => searchRef.current?.focus() },
      { id: "range", keys: ["g"], label: "Cycle history range", run: () => patchView({ range: RANGE_KEYS[(RANGE_KEYS.indexOf(view.range) + 1) % RANGE_KEYS.length] }) },
      { id: "wallet", keys: ["w"], label: "Cycle wallet filter", run: () => {
          const ids = ["", ...p.wallets.map((w) => w.id)];
          patchView({ walletId: ids[(ids.indexOf(view.walletId) + 1) % ids.length] });
        } },
      { id: "dust", keys: ["d"], label: "Toggle small balances", run: () => patchView({ hideDust: !view.hideDust }) },
    ],
    { enabled: active }
  );

  const source = selected ? p.byWallet[selected.id] : null;
  const holdings = useMemo(() => {
    let list = selected ? (source?.holdings || []).map((h) => ({ ...h, wallets: [selected.id] })) : p.summary.assets;
    const total = list.reduce((s, h) => s + h.value, 0);
    list = list.map((h) => ({ ...h, share: total ? (h.value / total) * 100 : 0 }));
    if (view.hideDust) list = list.filter((h) => h.value >= Number(settings.dustUsd || 0));
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((h) => h.symbol?.toLowerCase().includes(q) || h.name?.toLowerCase().includes(q) || h.assetId?.toLowerCase() === q);
    }
    const sorters = {
      value: (a, b) => b.value - a.value,
      change: (a, b) => (b.change24h ?? -1e9) - (a.change24h ?? -1e9),
      symbol: (a, b) => a.symbol.localeCompare(b.symbol),
      amount: (a, b) => b.amount - a.amount,
    };
    return list.sort(sorters[view.sort] || sorters.value);
  }, [selected, source, p.summary.assets, view.hideDust, view.sort, query, settings.dustUsd]);

  const total = selected ? source?.total ?? 0 : p.summary.total;
  const change = selected ? source?.change ?? 0 : p.summary.change;
  const changePct = total - change ? (change / (total - change)) * 100 : 0;

  const slices = useMemo(() => {
    if (view.alloc === "chain") {
      const chains = {};
      for (const h of holdings) chains[h.chain] = (chains[h.chain] || 0) + h.value;
      return toSlices(Object.entries(chains).map(([k, v]) => ({ key: k, label: CHAIN_NAMES[k] || k, value: v })));
    }
    if (view.alloc === "wallet") {
      return toSlices(p.wallets.filter((w) => !w.hidden).map((w) => ({ key: w.id, label: w.label, value: p.byWallet[w.id]?.total || 0 })));
    }
    // Same asset on several chains (e.g. ETH on mainnet + L2s) is one slice.
    const bySymbol = {};
    for (const h of holdings) {
      const k = h.symbol || h.id;
      bySymbol[k] = (bySymbol[k] || 0) + h.value;
    }
    return toSlices(Object.entries(bySymbol).map(([k, v]) => ({ key: k, label: k, value: v })));
  }, [view.alloc, holdings, p.wallets, p.byWallet]);

  const sparkFor = (walletId) => p.history.slice(-48).map((s) => (walletId ? s.wallets?.[walletId] ?? 0 : s.total));

  return (
    <div className="portfolio">
      {/* ------------------------------------------------------- SUMMARY */}
      <div className="summary resultgrid hero">
        <div>
          <div className="muted tiny">{selected ? selected.label : "Total portfolio"}</div>
          <div className="heroPnl">
            <span className="heroCur">$</span>
            <Private>
              <span className="heroNum">{fmtUsd(total).slice(1)}</span>
            </Private>
          </div>
          <div className={`heroRoi ${signClass(change)}`}>
            <Private>{fmtUsd(change, { sign: true })}</Private> ({fmtPct(changePct)}) <span className="muted tiny">24h</span>
          </div>
          {settings.showLocal && Number(settings.localRate) > 0 && (
            <div className="muted small">
              <Private>
                {Math.round(total * Number(settings.localRate)).toLocaleString("en-US")} {settings.localSymbol}
              </Private>
            </div>
          )}
        </div>
        <div className="summaryMeta">
          <Sparkline values={sparkFor(selected?.id)} width={120} height={36} />
          <div className="statusLine">
            <StatusDot status={p.solStatus} label={`Solana ${p.solStatus}`} />
            <StatusDot status={feed} label={`Prices ${feed}`} />
          </div>
          <div className="summaryActions">
            <button type="button" onClick={() => setShowAdd((v) => !v)}>
              + Wallet <Kbd combo="a" />
            </button>
            <button type="button" onClick={p.refreshAll} disabled={p.refreshing.size > 0}>
              {p.refreshing.size ? "Syncing…" : "Refresh"} <Kbd combo="u" />
            </button>
          </div>
        </div>
      </div>

      {(showAdd || noWallets) && (
        <Card title="Add wallet" actions={!noWallets && <button className="ghost" onClick={() => setShowAdd(false)}>✕</button>}>
          <AddWallet inputRef={addRef} onDone={() => setShowAdd(false)} />
        </Card>
      )}

      {!noWallets && (
        <>
          <div className="grid2">
            <HistoryCard
              history={p.history}
              range={view.range}
              setRange={(range) => patchView({ range })}
              walletId={selected?.id}
              walletLabel={selected?.label}
              liveTotal={total}
            />
            <Card
              title="Allocation"
              actions={
                <Segmented
                  size="sm"
                  value={view.alloc}
                  onChange={(alloc) => patchView({ alloc })}
                  options={[
                    { value: "asset", label: "Asset" },
                    { value: "chain", label: "Chain" },
                    { value: "wallet", label: "Wallet" },
                  ]}
                />
              }
            >
              <Donut
                items={slices}
                centerLabel={<Private>{fmtUsd(total, { dp: 0 })}</Private>}
                format={(v) => fmtUsd(v)}
                onSelect={(it) => view.alloc === "wallet" && it.key !== "other" && patchView({ walletId: it.key })}
              />
            </Card>
          </div>

          <WalletList view={view} patchView={patchView} sparkFor={sparkFor} />

          <Card
            title={`Holdings${selected ? ` · ${selected.label}` : ""}`}
            actions={
              <>
                <input
                  ref={searchRef}
                  className="input search"
                  placeholder="Search…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && (setQuery(""), e.currentTarget.blur())}
                  aria-label="Search holdings"
                />
                <Kbd combo="f" />
                <button type="button" className={`ghost ${view.hideDust ? "on" : ""}`} onClick={() => patchView({ hideDust: !view.hideDust })}>
                  {view.hideDust ? `≥ $${settings.dustUsd}` : "All"} <Kbd combo="d" />
                </button>
              </>
            }
          >
            <div className="tableScroll">
              <table className="table holdings">
                <thead>
                  <tr>
                    {[
                      ["symbol", "Asset"],
                      ["amount", "Amount"],
                      [null, "Price"],
                      ["change", "24h"],
                      ["value", "Value"],
                    ].map(([key, label]) => (
                      <th key={label} className={key ? "sortable" : ""} onClick={() => key && patchView({ sort: key })} aria-sort={view.sort === key ? "descending" : undefined}>
                        {label}
                        {view.sort === key && " ▾"}
                      </th>
                    ))}
                    <th aria-label="actions" />
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => (
                    <tr key={h.id}>
                      <td>
                        <div className="assetCell">
                          {h.icon ? <img src={h.icon} alt="" loading="lazy" width="22" height="22" /> : <span className="iconStub">{h.symbol?.[0]}</span>}
                          <div>
                            <b>{h.symbol}</b>
                            {!h.verified && <span className="badge warn" title="Not verified by Jupiter">?</span>}
                            <div className="muted tiny">
                              {CHAIN_NAMES[h.chain] || h.chain}
                              {h.wallets?.length > 1 && ` · ${h.wallets.length} wallets`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Private>{fmtToken(h.amount)}</Private>
                      </td>
                      <td>
                        {h.priced || h.live ? `$${fmtPrice(h.price)}` : <span className="muted">n/a</span>}
                        {h.live && <i className="liveDot" title="Streaming price" />}
                      </td>
                      <td className={signClass(h.change24h)}>{h.change24h != null ? fmtPct(h.change24h) : "—"}</td>
                      <td>
                        <Private>{fmtUsd(h.value)}</Private>
                        <div className="shareBar">
                          <i style={{ width: `${Math.min(100, h.share)}%` }} />
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ghost tiny"
                          title="Open in Spot calculator"
                          disabled={!h.price}
                          onClick={() =>
                            openInCalculator({
                              asset: ASSETS[h.symbol] ? h.symbol : h.symbol?.slice(0, 10) || "",
                              invest: String(Math.round(h.value * 100) / 100),
                              entry: String(h.price),
                            })
                          }
                        >
                          calc
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!holdings.length && (
                    <tr>
                      <td colSpan={6} className="muted center">
                        {p.refreshing.size ? "Loading balances…" : "No holdings to show"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <ActivityCard wallet={selected} />
        </>
      )}
    </div>
  );
}

function WalletList({ view, patchView, sparkFor }) {
  const p = usePortfolio();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const total = p.summary.total;

  const copy = async (addr) => {
    try {
      await navigator.clipboard.writeText(addr);
      toast("Address copied", "ok");
    } catch {
      /* ignore */
    }
  };

  return (
    <Card
      title="Wallets"
      actions={
        <button type="button" className={`ghost ${!view.walletId ? "on" : ""}`} onClick={() => patchView({ walletId: "" })}>
          All <Kbd combo="w" />
        </button>
      }
    >
      <ul className="walletList">
        {p.wallets.map((w, i) => {
          const data = p.byWallet[w.id] || {};
          const fam = CHAIN_FAMILIES[w.family];
          const isSel = view.walletId === w.id;
          const explorer = w.family === "evm" ? `${EVM_CHAINS[0].explorer}${w.address}` : `${fam.explorer}${w.address}`;
          return (
            <li key={w.id} className={`${isSel ? "selected" : ""} ${w.hidden ? "hiddenW" : ""} ${p.flash[w.id] ? `flash-${p.flash[w.id]}` : ""}`}>
              <button type="button" className="walletMain" onClick={() => patchView({ walletId: isSel ? "" : w.id })}>
                <span className={`chainBadge ${w.family}`}>{fam.short}</span>
                <span className="walletName">
                  {editing === w.id ? (
                    <input
                      className="input"
                      autoFocus
                      defaultValue={w.label}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        p.updateWallet(w.id, { label: e.target.value.trim() || w.label });
                        setEditing(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditing(null);
                      }}
                    />
                  ) : (
                    <b>{w.label}</b>
                  )}
                  <span className="muted tiny">
                    {shortAddr(w.address, 5)} ·{" "}
                    {p.refreshing.has(w.id)
                      ? "syncing…"
                      : data.error
                        ? <span className="neg" title={data.error}>error</span>
                        : data.fetchedAt
                          ? `${timeAgo(data.fetchedAt)}${data.source === "jupiter" ? " · via Jupiter" : ""}`
                          : "pending"}
                  </span>
                </span>
                <Sparkline values={sparkFor(w.id)} />
                <span className="walletValue">
                  <Private>{fmtUsd(data.total || 0)}</Private>
                  <span className="muted tiny">{w.hidden ? "excluded" : total ? fmtPct(((data.total || 0) / total) * 100, { sign: false, dp: 1 }) : ""}</span>
                </span>
              </button>
              <div className="walletActions">
                <button type="button" className="ghost tiny" title="Rename" onClick={() => setEditing(w.id)}>✎</button>
                <button type="button" className="ghost tiny" title="Copy address" onClick={() => copy(w.address)}>⧉</button>
                <a className="ghost tiny" href={explorer} target="_blank" rel="noreferrer" title="Open in explorer">↗</a>
                <button type="button" className="ghost tiny" title="Refresh" onClick={() => p.refreshWallet(w)}>↻</button>
                <button type="button" className="ghost tiny" title={w.hidden ? "Include in total" : "Exclude from total"} onClick={() => p.updateWallet(w.id, { hidden: !w.hidden })}>
                  {w.hidden ? "◌" : "◉"}
                </button>
                <button type="button" className="ghost tiny" title="Move up" disabled={i === 0} onClick={() => p.moveWallet(w.id, -1)}>▲</button>
                <button type="button" className="ghost tiny" title="Move down" disabled={i === p.wallets.length - 1} onClick={() => p.moveWallet(w.id, 1)}>▼</button>
                <button
                  type="button"
                  className="ghost tiny danger"
                  title="Remove"
                  onClick={() => {
                    if (window.confirm(`Remove ${w.label}?`)) {
                      p.removeWallet(w.id);
                      if (isSel) patchView({ walletId: "" });
                    }
                  }}
                >
                  ✕
                </button>
              </div>
              {data.error && !p.refreshing.has(w.id) && <div className="neg tiny warnLine">{data.error}</div>}
              {data.warnings?.length > 0 && <div className="muted tiny warnLine">Some chains failed: {data.warnings.join(", ")}</div>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ActivityCard({ wallet }) {
  const p = usePortfolio();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const targets = useMemo(
    () => (wallet ? [wallet] : p.wallets.filter((w) => w.family !== "evm")).slice(0, 5),
    [wallet, p.wallets]
  );
  const fetchedAtKey = targets.map((w) => p.cache[w.id]?.fetchedAt || 0).join(",");

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await Promise.allSettled(targets.map((w) => fetchActivity(w).then((list) => list.map((x) => ({ ...x, wallet: w })))));
      const ok = res.filter((r) => r.status === "fulfilled").flatMap((r) => r.value);
      if (!ok.length && res.some((r) => r.status === "rejected")) setErr("Could not load activity");
      setItems(ok.sort((a, b) => b.time - a.time).slice(0, 20));
    } finally {
      setLoading(false);
    }
  };

  // Reload when the wallet selection changes or a wallet's balances update.
  useEffect(() => {
    if (targets.length) load();
    else setItems([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets.map((w) => w.id).join(","), fetchedAtKey]);

  if (wallet?.family === "evm" || (!wallet && !targets.length)) return null;

  return (
    <Card title="Recent activity" actions={<button className="ghost" onClick={load} disabled={loading}>{loading ? "…" : "↻"}</button>}>
      {err && <p className="neg small">{err}</p>}
      <ul className="activity">
        {items.map((it) => (
          <li key={it.id}>
            <span className={`dot ${it.ok ? (it.pending ? "warn" : "pos") : "neg"}`} />
            <a href={it.url} target="_blank" rel="noreferrer" className="mono">
              {shortAddr(it.id, 6)}
            </a>
            <span className="muted tiny">{it.wallet.label}</span>
            <span className="muted tiny right">{it.pending ? "pending" : it.time ? timeAgo(it.time) : ""}</span>
          </li>
        ))}
        {!items.length && !loading && <li className="muted small">No recent transactions</li>}
      </ul>
    </Card>
  );
}
