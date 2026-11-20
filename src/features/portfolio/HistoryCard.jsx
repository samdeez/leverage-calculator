import React, { useMemo } from "react";
import LineChart from "../../components/charts/LineChart";
import { Card, Private, Segmented } from "../../components/ui";
import { KINDS, reconstructSeries } from "../../lib/activity";
import { fmt, fmtCompact, fmtDate, fmtPct, fmtToken, fmtUsd, signClass } from "../../lib/format";
import { RANGES, seriesFor, seriesStats } from "../../lib/history";

export const HISTORY_MODES = [
  { value: "activity", label: "Activity", title: "Value rebuilt from every on-chain balance change" },
  { value: "trades", label: "Trades", title: "Value moved only by swaps" },
  { value: "tracked", label: "Tracked", title: "Snapshots recorded while the app is open" },
];

const describe = (e) => {
  if (!e) return null;
  const legs = e.changes.map((c) => `${c.amount > 0 ? "+" : ""}${fmtToken(c.amount)} ${c.symbol}`).join("  ");
  return `${KINDS[e.kind]?.label || e.kind}${legs ? ` · ${legs}` : ""}`;
};

export default function HistoryCard({ history, events, priceOf, mode, setMode, range, setRange, walletId, walletLabel, total, ready = true }) {
  const series = useMemo(() => {
    const now = Date.now();
    const start = now - (RANGES[range] ?? Infinity);
    if (mode === "tracked") {
      const s = seriesFor(history, { range, walletId, now });
      if (s.length) s.push({ x: now, y: total });
      return s;
    }
    // Rebuilding needs today's balances as the anchor; wait until they're loaded.
    if (!ready) return [];
    const pts = reconstructSeries(events, { total, priceOf, mode, now }).map((p) => ({ ...p, y: Math.max(0, p.y) }));
    // Crop to the range. Known history only reaches back to the oldest fetched
    // transaction, so start there (with a little lead-in) rather than drawing
    // an invented flat line across the rest of the range.
    const oldest = events.length ? Math.min(...events.map((e) => e.time)) : now;
    const lead = Math.max(60000, (now - oldest) * 0.04);
    const from = Math.max(start, oldest - lead);
    const inRange = pts.filter((p) => p.x >= from);
    const before = pts.filter((p) => p.x < from).at(-1);
    const startY = before ? before.y : inRange[0]?.y;
    return startY == null ? [] : [{ x: from, y: startY }, ...inRange];
  }, [mode, history, range, walletId, total, events, priceOf, ready]);

  const stats = seriesStats(series);
  const spanDays = series.length > 1 ? (series[series.length - 1].x - series[0].x) / 864e5 : 0;
  const eventCount = new Set(series.filter((p) => p.event).map((p) => p.event.id)).size;
  const empty =
    mode === "tracked"
      ? "History builds up automatically while the app is open"
      : !ready
        ? "Waiting for current balances…"
        : events.length
        ? `No ${mode === "trades" ? "trades" : "activity"} in this range`
        : "Loading on-chain activity…";

  return (
    <Card
      title={`Value history${walletLabel ? ` · ${walletLabel}` : ""}`}
      className="historyCard"
      actions={
        <>
          <Segmented size="sm" value={mode} onChange={setMode} options={HISTORY_MODES} />
          <Segmented size="sm" value={range} onChange={setRange} options={Object.keys(RANGES).map((k) => ({ value: k, label: k }))} />
        </>
      }
    >
      <div className="historyStats">
        <span>
          <span className="muted tiny">Change </span>
          <b className={signClass(stats.change)}>
            <Private>{fmtUsd(stats.change, { sign: true })}</Private> ({fmtPct(stats.changePct)})
          </b>
        </span>
        <span>
          <span className="muted tiny">High </span>
          <Private>{fmtUsd(stats.high === -Infinity ? 0 : stats.high)}</Private>
        </span>
        <span>
          <span className="muted tiny">Low </span>
          <Private>{fmtUsd(stats.low === Infinity ? 0 : stats.low)}</Private>
        </span>
        {mode !== "tracked" && (
          <span className="muted tiny" title="Past balances are valued at today's prices">
            {eventCount} {mode === "trades" ? "trades" : "events"}
            {series.length ? ` since ${fmtDate(series[0].x)}` : ""} · at current prices
          </span>
        )}
      </div>
      <LineChart
        data={series.length > 1 ? series : []}
        height={200}
        minSpanFrac={0.02}
        color="var(--accent)"
        ariaLabel="Portfolio value over time"
        emptyText={empty}
        formatX={(x, axis) => (axis ? fmtDate(x, spanDays < 2) : fmtDate(x))}
        formatY={(y, axis) => (axis ? (Math.abs(y) < 10000 ? fmt(y, 2) : fmtCompact(y, 2)) : fmtUsd(y))}
        tooltip={(p) => (
          <>
            <b>{fmtUsd(p.y)}</b>
            <span>{fmtDate(p.x)}</span>
            {p.event && <span className="tipEvent">{describe(p.event)}</span>}
          </>
        )}
      />
    </Card>
  );
}
