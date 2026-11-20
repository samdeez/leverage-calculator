import React, { useEffect, useMemo, useRef, useState } from "react";
import NumberField from "../../components/NumberField";
import { Card, Field, Kbd, Private, Row, Segmented } from "../../components/ui";
import { useToast } from "../../context/Toast";
import { useHotkeys } from "../../hooks/useHotkeys";
import { useLivePrice } from "../../hooks/useLivePrice";
import { usePersistentState } from "../../hooks/usePersistentState";
import { fmt, fmtDate, fmtPct, fmtPrice, fmtToken, fmtUsd, signClass } from "../../lib/format";
import { alertsStore, journalStore, uid } from "../../lib/idbStore";
import { ASSET_SYMBOLS } from "../../lib/live";
import { dcaAverage, num, pctChange, positionSize } from "../../lib/math";

const TOOLS = [
  { value: "risk", label: "Position size", combo: "shift+1" },
  { value: "dca", label: "DCA average", combo: "shift+2" },
  { value: "journal", label: "Journal", combo: "shift+3" },
  { value: "alerts", label: "Alerts", combo: "shift+4" },
];

export default function Tools({ active, loadScenario }) {
  const [tool, setTool] = usePersistentState("levcal:tools.tab.v1", "risk");
  useHotkeys(
    "Tools",
    TOOLS.map((t) => ({ id: t.value, keys: [t.combo], label: `Open ${t.label}`, run: () => setTool(t.value) })),
    { enabled: active }
  );
  return (
    <div className="tools">
      <Segmented value={tool} onChange={setTool} options={TOOLS} className="toolTabs" />
      {tool === "risk" && <PositionSizer />}
      {tool === "dca" && <DcaCalculator />}
      {tool === "journal" && <Journal loadScenario={loadScenario} />}
      {tool === "alerts" && <Alerts />}
    </div>
  );
}

/* ------------------------------------------------------------ position size */

function PositionSizer() {
  const [s, setS] = usePersistentState("levcal:tools.risk.v1", {
    account: "1000",
    risk: "1",
    entry: "",
    stop: "",
    target: "",
    leverage: "5",
  });
  const r = positionSize({ account: s.account, riskPct: s.risk, entry: s.entry, stop: s.stop, target: s.target, leverage: s.leverage });
  const patch = (p) => setS((c) => ({ ...c, ...p }));
  return (
    <div className="container">
      <div className="insidecol" data-fieldgroup>
        <h2 className="colTitle">risk-based position size:</h2>
        <hr />
        <Field label="Account size:" suffix="$">
          <NumberField value={s.account} onChange={(v) => patch({ account: v })} step={100} aria-label="Account size" />
        </Field>
        <Field label="Risk per trade:" suffix="%">
          <NumberField value={s.risk} onChange={(v) => patch({ risk: v })} step={0.25} max={100} aria-label="Risk per trade" />
        </Field>
        <Field label="Entry price:" suffix="$">
          <NumberField value={s.entry} onChange={(v) => patch({ entry: v })} placeholder="0" aria-label="Entry" />
        </Field>
        <Field label="Stop loss:" suffix="$">
          <NumberField value={s.stop} onChange={(v) => patch({ stop: v })} emptyBase={s.entry} placeholder="0" aria-label="Stop loss" />
        </Field>
        <Field label="Take profit:" suffix="$">
          <NumberField value={s.target} onChange={(v) => patch({ target: v })} emptyBase={s.entry} placeholder="optional" aria-label="Take profit" />
        </Field>
        <Field label="Max leverage:" suffix="x">
          <NumberField value={s.leverage} onChange={(v) => patch({ leverage: v })} step={1} min={1} aria-label="Leverage" />
        </Field>
      </div>
      <div className="insidecol">
        <p className="outputLabel">Position:</p>
        <div className={`resultgrid hero ${r.side === "short" ? "neg" : "pos"}`}>
          <div className="heroPnl">
            <span className="heroCur">$</span>
            <span className="heroNum">{fmt(r.size, 2)}</span>
            <span className="muted tiny"> size ({r.side})</span>
          </div>
          <div className="heroRoi">
            {fmtToken(r.qty)} <span className="muted tiny">units</span>
          </div>
        </div>
        <div className="statGrid">
          <Row label="Amount at risk" className="neg">
            {fmtUsd(r.riskAmount)}
          </Row>
          <Row label="Stop distance">{fmtPct(r.stopPct)}</Row>
          <Row label={`Margin @ ${fmt(Math.max(1, num(s.leverage)), 0)}x`}>{fmtUsd(r.margin)}</Row>
          <Row label="Effective leverage">{fmt(r.leverageNeeded, 2)}x</Row>
          <Row label="Reward" className="pos">
            {fmtUsd(r.reward)}
          </Row>
          <Row label="Risk : Reward" className={r.rr >= 2 ? "pos" : r.rr && r.rr < 1 ? "neg" : ""}>
            {r.rr ? `1 : ${fmt(r.rr, 2)}` : "—"}
          </Row>
          <Row label="Target move">{fmtPct(r.targetPct)}</Row>
          <Row label="Win rate to break even">{r.rr ? fmtPct(100 / (1 + r.rr), { sign: false, dp: 1 }) : "—"}</Row>
        </div>
        {r.margin > num(s.account) && <p className="neg small">Margin exceeds account size — raise leverage or lower risk.</p>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- DCA */

function DcaCalculator() {
  const [s, setS] = usePersistentState("levcal:tools.dca.v1", {
    buys: [
      { id: "a", price: "150", amount: "100" },
      { id: "b", price: "120", amount: "100" },
      { id: "c", price: "95", amount: "100" },
    ],
    current: "",
  });
  const r = dcaAverage(s.buys);
  const value = r.qty * num(s.current);
  const pnl = num(s.current) ? value - r.usd : 0;
  const setBuy = (id, patch) => setS((c) => ({ ...c, buys: c.buys.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  return (
    <div className="container">
      <div className="insidecol" data-fieldgroup>
        <h2 className="colTitle">dollar-cost average:</h2>
        <hr />
        <table className="table dca">
          <thead>
            <tr>
              <th>#</th>
              <th>Price $</th>
              <th>Amount $</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.buys.map((b, i) => (
              <tr key={b.id}>
                <td className="muted">{i + 1}</td>
                <td>
                  <NumberField value={b.price} onChange={(v) => setBuy(b.id, { price: v })} aria-label={`Buy ${i + 1} price`} />
                </td>
                <td>
                  <NumberField value={b.amount} onChange={(v) => setBuy(b.id, { amount: v })} step={10} aria-label={`Buy ${i + 1} amount`} />
                </td>
                <td>
                  <button type="button" className="ghost tiny danger" onClick={() => setS((c) => ({ ...c, buys: c.buys.filter((x) => x.id !== b.id) }))}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="actionRow">
          <button type="button" onClick={() => setS((c) => ({ ...c, buys: [...c.buys, { id: uid(), price: "", amount: c.buys.at(-1)?.amount || "100" }] }))}>
            + Add buy
          </button>
        </div>
        <Field label="Current price:" suffix="$">
          <NumberField value={s.current} onChange={(v) => setS((c) => ({ ...c, current: v }))} placeholder="0" aria-label="Current price" />
        </Field>
      </div>
      <div className="insidecol">
        <p className="outputLabel">Average entry:</p>
        <div className="resultgrid hero">
          <div className="heroPnl">
            <span className="heroCur">$</span>
            <span className="heroNum">{fmtPrice(r.avg)}</span>
          </div>
          <div className="heroRoi">
            {fmtToken(r.qty)} <span className="muted tiny">units for</span> {fmtUsd(r.usd)}
          </div>
        </div>
        <div className="statGrid">
          <Row label="Current value">{fmtUsd(value)}</Row>
          <Row label="Unrealized P&L" className={signClass(pnl)}>
            {fmtUsd(pnl, { sign: true })}
          </Row>
          <Row label="vs. average" className={signClass(pctChange(r.avg, s.current))}>
            {num(s.current) ? fmtPct(pctChange(r.avg, s.current)) : "—"}
          </Row>
          <Row label="vs. first buy">{num(s.buys[0]?.price) ? fmtPct(pctChange(s.buys[0].price, r.avg)) : "—"}</Row>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ journal */

function Journal({ loadScenario }) {
  const entries = journalStore.use();
  const toast = useToast();
  const [filter, setFilter] = useState("all");
  const list = entries.filter((e) => filter === "all" || e.mode === filter);
  const totals = useMemo(() => {
    const wins = list.filter((e) => e.pnl > 0).length;
    return { count: list.length, wins, pnl: list.reduce((s, e) => s + (e.pnl || 0), 0) };
  }, [list]);

  const exportCsv = () => {
    const rows = [["date", "mode", "asset", "side", "amount", "entry", "exit", "leverage", "pnl", "roi", "note"]];
    for (const e of list) {
      const s = e.state;
      rows.push([new Date(e.t).toISOString(), e.mode, s.asset, s.side || "long", s.invest, s.entry, s.exit, s.leverage || 1, e.pnl?.toFixed(2), e.roi?.toFixed(2), JSON.stringify(e.note || "")]);
    }
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "levcal-journal.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card
      title="Trade journal"
      actions={
        <>
          <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "spot", label: "Spot" }, { value: "leverage", label: "Leverage" }]} />
          <button className="ghost" onClick={exportCsv} disabled={!list.length}>
            CSV
          </button>
        </>
      }
    >
      <div className="historyStats">
        <span>
          <span className="muted tiny">Entries </span>
          {totals.count}
        </span>
        <span>
          <span className="muted tiny">Winners </span>
          {totals.count ? fmtPct((totals.wins / totals.count) * 100, { sign: false, dp: 0 }) : "—"}
        </span>
        <span>
          <span className="muted tiny">Planned P&L </span>
          <b className={signClass(totals.pnl)}>
            <Private>{fmtUsd(totals.pnl, { sign: true })}</Private>
          </b>
        </span>
      </div>
      {!list.length && (
        <p className="muted small">
          Save a scenario from the Spot or Leverage tab with <Kbd combo="j" /> or the Save button.
        </p>
      )}
      <ul className="journal">
        {list.map((e) => {
          const s = e.state;
          return (
            <li key={e.id}>
              <div className="jHead">
                <span className={`badge ${e.mode === "spot" ? "" : s.side === "short" ? "neg" : "pos"}`}>
                  {e.mode === "spot" ? "SPOT" : `${(s.side || "long").toUpperCase()} ${s.leverage}x`}
                </span>
                <b>{s.asset}</b>
                <span className="muted small">
                  ${fmtPrice(s.entry)} → ${fmtPrice(s.exit)}
                </span>
                <span className={`right ${signClass(e.pnl)}`}>
                  <Private>{fmtUsd(e.pnl, { sign: true })}</Private> ({fmtPct(e.roi, { dp: 1 })})
                </span>
              </div>
              <div className="jBody">
                <input
                  className="input wide"
                  placeholder="Add a note…"
                  defaultValue={e.note}
                  onBlur={(ev) => journalStore.set((j) => j.map((x) => (x.id === e.id ? { ...x, note: ev.target.value } : x)))}
                />
                <span className="muted tiny">{fmtDate(e.t)}</span>
                <button className="ghost tiny" onClick={() => loadScenario(e.mode, s)}>
                  load
                </button>
                <button
                  className="ghost tiny danger"
                  onClick={() => {
                    journalStore.set((j) => j.filter((x) => x.id !== e.id));
                    toast("Entry deleted");
                  }}
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------------- alerts */

function Alerts() {
  const alerts = alertsStore.use();
  const [form, setForm] = useState({ symbol: "SOL", op: "above", price: "" });
  const tick = useLivePrice(form.symbol);
  const permission = typeof Notification !== "undefined" ? Notification.permission : "unsupported";
  const priceRef = useRef(null);

  const add = (e) => {
    e.preventDefault();
    if (!num(form.price)) return;
    alertsStore.set((a) => [{ id: uid(), ...form, price: num(form.price), active: true, createdAt: Date.now() }, ...a]);
    setForm((f) => ({ ...f, price: "" }));
    if (permission === "default") Notification.requestPermission?.();
  };

  return (
    <div className="container">
      <div className="insidecol">
        <h2 className="colTitle">price alerts:</h2>
        <hr />
        <form onSubmit={add} data-fieldgroup>
          <Field label="Asset:" suffix={tick ? `$${fmtPrice(tick.price)}` : ""}>
            <select className="input" value={form.symbol} onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))} aria-label="Alert asset">
              {ASSET_SYMBOLS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="When price is:" suffix="">
            <Segmented value={form.op} onChange={(op) => setForm((f) => ({ ...f, op }))} options={[{ value: "above", label: "≥ above" }, { value: "below", label: "≤ below" }]} />
          </Field>
          <Field label="Target:" suffix="$">
            <NumberField getInputRef={priceRef} value={form.price} emptyBase={tick?.price} onChange={(v) => setForm((f) => ({ ...f, price: v }))} placeholder={tick ? fmtPrice(tick.price) : "0"} aria-label="Alert price" />
          </Field>
          <div className="actionRow">
            <button type="submit" className="primary" disabled={!num(form.price)}>
              Add alert <Kbd combo="enter" />
            </button>
          </div>
        </form>
        <p className="muted tiny">
          Alerts are checked against the live feed while this app is open.{" "}
          {permission === "denied" ? "Browser notifications are blocked; you'll see in-app toasts." : permission === "granted" ? "Browser notifications are on." : ""}
        </p>
      </div>
      <div className="insidecol">
        <p className="outputLabel">Active alerts:</p>
        <ul className="journal">
          {alerts.map((a) => (
            <AlertRow key={a.id} a={a} />
          ))}
          {!alerts.length && <li className="muted small">No alerts yet</li>}
        </ul>
      </div>
    </div>
  );
}

function AlertRow({ a }) {
  const tick = useLivePrice(a.symbol);
  const dist = tick ? pctChange(tick.price, a.price) : null;
  return (
    <li className={a.active ? "" : "fired"}>
      <div className="jHead">
        <b>{a.symbol}</b>
        <span>
          {a.op === "above" ? "≥" : "≤"} ${fmtPrice(a.price)}
        </span>
        <span className="muted small">{dist != null && a.active ? `${fmtPct(dist)} away` : a.firedAt ? `fired ${fmtDate(a.firedAt)}` : ""}</span>
        <span className="right">
          <button className="ghost tiny" onClick={() => alertsStore.set((l) => l.map((x) => (x.id === a.id ? { ...x, active: !x.active, firedAt: null } : x)))}>
            {a.active ? "pause" : "re-arm"}
          </button>
          <button className="ghost tiny danger" onClick={() => alertsStore.set((l) => l.filter((x) => x.id !== a.id))}>
            ✕
          </button>
        </span>
      </div>
    </li>
  );
}

/** Background watcher mounted at the app root: fires alerts from live ticks. */
export function AlertWatcher() {
  const alerts = alertsStore.use();
  const toast = useToast();
  const symbols = [...new Set(alerts.filter((a) => a.active).map((a) => a.symbol))];
  return symbols.map((s) => <AlertSymbolWatcher key={s} symbol={s} alerts={alerts} toast={toast} />);
}

function AlertSymbolWatcher({ symbol, alerts, toast }) {
  const tick = useLivePrice(symbol);
  useEffect(() => {
    if (!tick?.price) return;
    // Read the store, not the render-time list, so an alert can only fire once.
    const hit = alertsStore.get().filter((a) => a.active && a.symbol === symbol && (a.op === "above" ? tick.price >= a.price : tick.price <= a.price));
    if (!hit.length) return;
    alertsStore.set((l) => l.map((x) => (hit.some((h) => h.id === x.id) ? { ...x, active: false, firedAt: Date.now() } : x)));
    for (const h of hit) {
      const text = `${symbol} is ${h.op} $${fmtPrice(h.price)} (now $${fmtPrice(tick.price)})`;
      toast(`🔔 ${text}`, "ok", 8000);
      try {
        if (Notification.permission === "granted") new Notification("Price alert", { body: text });
      } catch {
        /* notifications unsupported */
      }
    }
  }, [tick?.price, symbol, alerts, toast]);
  return null;
}
