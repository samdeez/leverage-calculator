import React from "react";
import { useFeedStatus, useLivePrices } from "../hooks/useLivePrice";
import { fmtPct, fmtPrice, signClass } from "../lib/format";
import { StatusDot } from "./ui";

const SYMBOLS = ["SOL", "BTC", "ETH", "JUP"];

/** Streaming prices strip under the header. Click a symbol to load it in the calculator. */
export default function LiveTicker({ onPick }) {
  const ticks = useLivePrices(SYMBOLS);
  const status = useFeedStatus();
  return (
    <div className="ticker">
      <StatusDot status={status} label={status === "live" ? "LIVE" : status.toUpperCase()} />
      {SYMBOLS.map((s) => {
        const t = ticks[s];
        return (
          <button key={s} type="button" className="tick" onClick={() => onPick(s, t?.price)} title={`Use ${s} in calculator`}>
            <b>{s}</b>
            <span key={t?.price} className={t ? (t.price >= t.prev ? "up" : "down") : ""}>
              {t ? `$${fmtPrice(t.price)}` : "…"}
            </span>
            {t?.change != null && <small className={signClass(t.change)}>{fmtPct(t.change, { dp: 1 })}</small>}
          </button>
        );
      })}
    </div>
  );
}
