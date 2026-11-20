import React, { useMemo } from "react";
import LineChart from "../../components/charts/LineChart";
import { Card, Private, Segmented } from "../../components/ui";
import { fmt, fmtCompact, fmtDate, fmtPct, fmtUsd, signClass } from "../../lib/format";
import { RANGES, seriesFor, seriesStats } from "../../lib/history";

export default function HistoryCard({ history, range, setRange, walletId, walletLabel, liveTotal }) {
  const series = useMemo(() => {
    const s = seriesFor(history, { range, walletId });
    // The newest point always shows the live value.
    if (liveTotal != null && s.length) s.push({ x: Date.now(), y: liveTotal });
    return s;
  }, [history, range, walletId, liveTotal]);
  const stats = seriesStats(series);
  const spanDays = series.length > 1 ? (series[series.length - 1].x - series[0].x) / 864e5 : 0;

  return (
    <Card
      title={`Value history${walletLabel ? ` · ${walletLabel}` : ""}`}
      className="historyCard"
      actions={
        <Segmented
          size="sm"
          value={range}
          onChange={setRange}
          options={Object.keys(RANGES).map((k) => ({ value: k, label: k }))}
        />
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
      </div>
      <LineChart
        data={series.length > 1 ? series : []}
        height={200}
        color="var(--accent)"
        ariaLabel="Portfolio value over time"
        emptyText="History builds up automatically while the app is open"
        formatX={(x, axis) => (axis ? fmtDate(x, spanDays < 2) : fmtDate(x))}
        formatY={(y, axis) => (axis ? (Math.abs(y) < 10000 ? fmt(y, 2) : fmtCompact(y, 2)) : fmtUsd(y))}
      />
    </Card>
  );
}
