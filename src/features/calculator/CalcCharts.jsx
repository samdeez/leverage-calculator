import React, { useMemo, useState } from "react";
import LineChart from "../../components/charts/LineChart";
import { Card, Private } from "../../components/ui";
import { fmt, fmtCompact, fmtPct, fmtPrice, fmtUsd, signClass } from "../../lib/format";
import { SCENARIO_MOVES, autoStep, num, priceFromPct } from "../../lib/math";
import { runCalc } from "./config";

/** P&L as a function of exit price. Click or drag on the chart to set the exit. */
export function PayoffCard({ mode, s, r, onPick }) {
  const entry = num(s.entry);
  const exit = num(s.exit);
  const lev = mode === "leverage" ? Math.max(1, num(s.leverage)) : 1;

  // While dragging, the x-range is frozen. Otherwise moving the exit toward an
  // edge widened the range, which moved the edge further out — a runaway loop.
  const [frozen, setFrozen] = useState(null);

  const auto = useMemo(() => {
    if (!entry || !num(s.invest)) return null;
    // Show a window that covers the planned exit and (for leverage) liquidation.
    let span = entry * Math.min(0.6, Math.max(0.05, 1.6 / lev));
    if (exit) span = Math.max(span, Math.abs(exit - entry) * 1.35);
    return [Math.max(0, entry - span), entry + span];
  }, [entry, exit, lev, s.invest]);
  const domain = frozen || auto;

  const data = useMemo(() => {
    if (!domain) return [];
    const [lo, hi] = domain;
    const pts = [];
    const n = 160;
    for (let i = 0; i <= n; i++) {
      const x = lo + ((hi - lo) * i) / n;
      pts.push({ x, y: runCalc(mode, s, x).pnl });
    }
    return pts;
  }, [mode, s, domain]);

  // Snap picks to ~0.1% of entry so values don't jitter through many decimals.
  const pick = (x) => {
    if (!domain) return;
    const step = autoStep(entry) / 10;
    const clamped = Math.min(domain[1], Math.max(domain[0], x));
    onPick(Math.round(clamped / step) * step);
  };

  const markers = [
    { x: entry, label: "Entry", tone: "entry" },
    exit ? { x: exit, label: "Exit", tone: "exit" } : null,
    r.breakEven ? { x: r.breakEven, label: "BE", tone: "be" } : null,
    mode === "leverage" && r.liq ? { x: r.liq, label: "Liq", tone: "liq" } : null,
  ].filter(Boolean);

  return (
    <Card title="P&L vs exit price" actions={<span className="muted tiny">click / drag to set exit</span>}>
      <LineChart
        data={data}
        xDomain={domain}
        height={220}
        baseline={0}
        markers={markers}
        onPick={pick}
        onPickStart={() => setFrozen(auto)}
        onPickEnd={() => setFrozen(null)}
        ariaLabel="Profit and loss by exit price"
        emptyText="Enter an amount and entry price"
        formatX={(x) => `$${fmtPrice(x)}`}
        formatY={(y, axis) => (axis ? fmtCompact(y, 1) : fmtUsd(y, { sign: true }))}
        tooltip={(p) => (
          <>
            <b className={signClass(p.y)}>{fmtUsd(p.y, { sign: true })}</b>
            <span>
              exit ${fmtPrice(p.x)} · {fmtPct(((p.x - entry) / entry) * 100)}
            </span>
          </>
        )}
      />
    </Card>
  );
}

/** What-if table. Click a row to apply that % move. */
export function ScenarioCard({ mode, s, onPick }) {
  const entry = num(s.entry);
  const current = num(s.pct);
  const rows = useMemo(
    () =>
      SCENARIO_MOVES.map((m) => {
        const price = priceFromPct(entry, m);
        const res = runCalc(mode, s, price);
        return { m, price, ...res };
      }),
    [mode, s, entry]
  );
  const nearest = SCENARIO_MOVES.reduce((a, b) => (Math.abs(b - current) < Math.abs(a - current) ? b : a));

  return (
    <Card title="Scenarios" actions={<span className="muted tiny">click a row</span>}>
      <table className="table scenario">
        <thead>
          <tr>
            <th>Move</th>
            <th>Price</th>
            <th>P&L</th>
            <th>ROI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.m}
              className={`${row.m === nearest && s.pct !== "" ? "current" : ""} ${row.liquidated ? "liq" : ""}`}
              onClick={() => onPick(row.m)}
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onPick(row.m)}
            >
              <td className={signClass(row.m)}>{fmtPct(row.m, { dp: 0 })}</td>
              <td>{entry ? `$${fmtPrice(row.price)}` : "—"}</td>
              <td className={signClass(row.pnl)}>
                <Private>{fmtUsd(row.pnl, { sign: true })}</Private>
                {row.liquidated && <span className="badge neg">LIQ</span>}
              </td>
              <td className={signClass(row.roi)}>{fmtPct(row.roi, { dp: 1 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** Compound growth for the spot tab. */
export function CompoundCard({ s, comp, local }) {
  const trades = Math.floor(num(s.trades));
  return (
    <>
      <p className="outputLabel">Compounding:</p>
      <div className="resultgrid compound">
        <div className="muted">
          profit after <span className="bright big">{fmt(trades, 0)}</span> compound trades at{" "}
          <span className={signClass(s.pct)}>{fmtPct(s.pct)}</span>:
        </div>
        <div className="gold big">
          <Private>{fmtUsd(comp.profit, { dp: 0 })}</Private>
          <span className="muted small"> ({fmt(comp.multiple, 2)}x)</span>
        </div>
        {local && (
          <div className="muted">
            <Private>{local(comp.profit)}</Private>
          </div>
        )}
        {trades > 1 && (
          <LineChart
            data={comp.series}
            height={140}
            color="var(--gold)"
            ariaLabel="Equity over compound trades"
            formatX={(x, axis) => (axis ? `#${fmt(x, 0)}` : `after trade ${fmt(x, 0)}`)}
            formatY={(y, axis) => (axis ? fmtCompact(y, 1) : fmtUsd(y))}
          />
        )}
      </div>
    </>
  );
}
