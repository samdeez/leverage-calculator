import React, { useEffect, useMemo, useRef, useState } from "react";
import NumberField from "../../components/NumberField";
import { Field, Kbd, Private, Row, Segmented, StatusDot } from "../../components/ui";
import { useToast } from "../../context/Toast";
import { useHotkeys } from "../../hooks/useHotkeys";
import { useLivePrice } from "../../hooks/useLivePrice";
import { usePersistentState } from "../../hooks/usePersistentState";
import { fmt, fmtPct, fmtPrice, fmtToken, fmtUsd, signClass } from "../../lib/format";
import { journalStore, uid } from "../../lib/idbStore";
import { ASSET_SYMBOLS } from "../../lib/live";
import { clamp, num, priceDecimals, toNumStr } from "../../lib/math";
import { setSettings, useSettings } from "../../lib/settingsStore";
import { CompoundCard, PayoffCard, ScenarioCard } from "./CalcCharts";
import { DEFAULTS, fromShareHash, runCalc, runCompound, toShareHash } from "./config";
import { setEntry, setExit, setPct } from "./linkedPrices";

const NOTES = {
  spot: ["Don't get greedy! Take profits while you can!", "Stick to the plan! Don't FOMO!", "WGMI 2025/2026"],
  leverage: ["Don't get greedy! Take profits while you can!", "Size down, survive first.", "WAGMI 2025/2026"],
};

export default function TradeCalculator({ mode, active, incoming }) {
  const isLev = mode === "leverage";
  const [s, setS] = usePersistentState(`levcal:calc.${mode}.v2`, () => {
    const shared = typeof window !== "undefined" ? fromShareHash(mode, window.location.hash) : null;
    return shared ? { ...DEFAULTS[mode], ...shared, anchor: "exit" } : DEFAULTS[mode];
  });
  const settings = useSettings();
  const toast = useToast();
  const [track, setTrack] = useState(false);
  const firstInput = useRef(null);
  const tick = useLivePrice(s.asset);

  // Apply a shared link once (also overrides persisted state).
  useEffect(() => {
    const shared = fromShareHash(mode, window.location.hash);
    if (shared) {
      setS((cur) => setExit(setEntry({ ...cur, ...shared }, shared.entry ?? cur.entry), shared.exit ?? cur.exit));
      history.replaceState(null, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefill from elsewhere in the app (e.g. "open in calculator" on a holding).
  useEffect(() => {
    if (incoming?.mode === mode) setS((cur) => setEntry({ ...cur, ...incoming.patch }, incoming.patch.entry ?? cur.entry));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming?.nonce]);

  // Live exit tracking: the exit price follows the market in real time.
  useEffect(() => {
    if (track && tick?.price) setS((cur) => setExit(cur, toNumStr(tick.price, 8)));
  }, [track, tick?.price, setS]);

  const patch = (p) => setS((cur) => ({ ...cur, ...p }));
  const r = useMemo(() => runCalc(mode, s), [mode, s]);
  const comp = useMemo(() => (isLev ? null : runCompound(s)), [isLev, s]);
  const local = (v) => `${fmt(num(v) * num(settings.localRate), 0)} ${settings.localSymbol}`;
  const showLocal = settings.showLocal && num(settings.localRate) > 0;

  const useLive = () => {
    if (!tick?.price) return toast(`No live price for ${s.asset || "asset"} yet`, "warn");
    setS((cur) => setEntry(cur, toNumStr(tick.price, 8)));
    toast(`Entry set to live ${s.asset} ${fmtPrice(tick.price)}`);
  };
  const reset = () => {
    setTrack(false);
    setS(DEFAULTS[mode]);
    toast("Calculator reset");
  };
  const save = () => {
    journalStore.set((j) => [
      { id: uid(), t: Date.now(), mode, state: s, pnl: r.pnl, roi: r.roi, note: "" },
      ...j,
    ]);
    toast("Saved to journal (Tools tab)", "ok");
  };
  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}${toShareHash(mode, s)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Share link copied", "ok");
    } catch {
      window.prompt("Copy this link", url);
    }
  };
  const bumpLev = (d) => patch({ leverage: String(clamp(Math.round(num(s.leverage)) + d, 1, 200)) });

  useHotkeys(
    isLev ? "Leverage" : "Spot",
    [
      { id: "focus", keys: ["/"], label: "Focus first input", run: () => firstInput.current?.focus() },
      { id: "live", keys: ["p"], label: "Use live price as entry", run: useLive },
      { id: "track", keys: ["t"], label: "Track exit price live", run: () => setTrack((v) => !v) },
      ...(isLev
        ? [
            { id: "side", keys: ["x"], label: "Toggle long / short", run: () => patch({ side: s.side === "short" ? "long" : "short" }) },
            { id: "levUp", keys: ["]"], label: "Leverage +1x", run: () => bumpLev(1) },
            { id: "levDn", keys: ["["], label: "Leverage −1x", run: () => bumpLev(-1) },
          ]
        : []),
      { id: "save", keys: ["j"], label: "Save scenario to journal", run: save },
      { id: "link", keys: ["c"], label: "Copy share link", run: copyLink },
      { id: "reset", keys: ["shift+r"], label: "Reset calculator", run: reset },
    ],
    { enabled: active }
  );

  const pnlTone = r.pnl < 0 ? "neg" : r.pnl > 0 ? "pos" : "";

  return (
    <div className="calc">
      <div className="container">
        {/* ------------------------------------------------------- INPUTS */}
        <div className="insidecol" data-fieldgroup>
          <h2 className="colTitle">input {isLev ? "leverage" : "spot"} trade:</h2>
          <hr />

          <div className="assetBar">
            <input
              className="input assetInput"
              list="asset-list"
              value={s.asset}
              aria-label="Asset"
              onChange={(e) => patch({ asset: e.target.value.toUpperCase().slice(0, 10) })}
            />
            <datalist id="asset-list">
              {ASSET_SYMBOLS.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
            <div className={`livePrice ${tick ? (tick.price >= tick.prev ? "up" : "down") : ""}`} key={tick?.ts}>
              {tick ? `$${fmtPrice(tick.price)}` : "—"}
              {tick?.change != null && <small className={signClass(tick.change)}>{fmtPct(tick.change)}</small>}
            </div>
            <button type="button" onClick={useLive} title="Use live price as entry">
              Live <Kbd combo="p" />
            </button>
            <button type="button" className={track ? "on" : ""} onClick={() => setTrack((v) => !v)} title="Exit price follows the market">
              {track ? "● Tracking" : "Track"} <Kbd combo="t" />
            </button>
          </div>

          {isLev && (
            <div className="inputContainer">
              <span className="inputLabel">Side:</span>
              <Segmented
                className="sideToggle"
                value={s.side}
                onChange={(side) => patch({ side })}
                options={[
                  { value: "long", label: "Long ⬆", className: "long" },
                  { value: "short", label: "Short ⬇", className: "short" },
                ]}
              />
              <div className="inputSuffix">
                <Kbd combo="x" />
              </div>
            </div>
          )}

          <Field label={isLev ? "Collateral:" : "Buy Amount:"} suffix="$">
            <NumberField getInputRef={firstInput} value={s.invest} onChange={(v) => patch({ invest: v })} step={10} placeholder="0" aria-label={isLev ? "Collateral" : "Buy Amount"} />
          </Field>
          <Field label={isLev ? "Entry Price:" : "Buy Price:"} suffix="$">
            <NumberField value={s.entry} onChange={(v) => setS((c) => setEntry(c, v))} placeholder="0" aria-label={isLev ? "Entry Price" : "Buy Price"} />
          </Field>
          <Field label={isLev ? "Exit Price:" : "Sell Price:"} suffix="$">
            <NumberField
              value={s.exit}
              onChange={(v) => {
                setTrack(false);
                setS((c) => setExit(c, v));
              }}
              emptyBase={s.entry}
              placeholder="0"
              aria-label={isLev ? "Exit Price" : "Sell Price"}
            />
          </Field>
          <Field label="% Change:" suffix="%">
            <NumberField
              value={s.pct}
              onChange={(v) => {
                setTrack(false);
                setS((c) => setPct(c, v));
              }}
              step={0.5}
              allowNegative
              min={-100}
              placeholder="0"
              aria-label="% Change"
            />
          </Field>

          {isLev && (
            <>
              <Field label="Leverage:" suffix="x" hint={<><Kbd combo="[" /><Kbd combo="]" /></>}>
                <NumberField value={s.leverage} onChange={(v) => patch({ leverage: v })} step={1} min={1} max={200} placeholder="1" aria-label="Leverage" />
              </Field>
              <div className="inputContainer slider">
                <span className="inputLabel" />
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={clamp(num(s.leverage) || 1, 1, 100)}
                  onChange={(e) => patch({ leverage: e.target.value })}
                  aria-label="Leverage slider"
                  tabIndex={-1}
                />
                <div className="inputSuffix" />
              </div>
            </>
          )}

          <Field label={isLev ? "Fees (round trip):" : "Fees:"} suffix="%">
            <NumberField value={s.fee} onChange={(v) => patch({ fee: v })} step={0.01} placeholder="0" aria-label="Fees" />
          </Field>

          {isLev ? (
            <>
              <Field label="Funding Rate/h:" suffix="%">
                <NumberField value={s.funding} onChange={(v) => patch({ funding: v })} step={0.001} allowNegative placeholder="0" aria-label="Funding Rate" />
              </Field>
              <Field label="Hours Open:" suffix="h">
                <NumberField value={s.hours} onChange={(v) => patch({ hours: v })} step={1} placeholder="0" aria-label="Hours Open" />
              </Field>
              <Field label="Maint. Margin:" suffix="%">
                <NumberField value={s.mmr} onChange={(v) => patch({ mmr: v })} step={0.1} max={50} placeholder="0" aria-label="Maintenance Margin" />
              </Field>
            </>
          ) : (
            <Field label="Compound Trades:" suffix="#">
              <NumberField value={s.trades} onChange={(v) => patch({ trades: v })} step={1} max={10000} decimalScale={0} placeholder="1" aria-label="Compound Trades" />
            </Field>
          )}

          <Field label="USD Price:" suffix={settings.localSymbol}>
            <NumberField value={String(settings.localRate ?? "")} onChange={(v) => setSettings({ localRate: v })} step={1000} placeholder="0" aria-label="USD Price" />
          </Field>

          <div className="actionRow">
            <button type="button" onClick={save}>
              Save <Kbd combo="j" />
            </button>
            <button type="button" onClick={copyLink}>
              Share <Kbd combo="c" />
            </button>
            <button type="button" className="ghost" onClick={reset}>
              Reset <Kbd combo="shift+r" />
            </button>
          </div>

          <div className="note">
            {NOTES[mode].map((n) => (
              <p key={n}>- {n}</p>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------------ RESULTS */}
        <div className="insidecol">
          <p className="outputLabel">
            P&L {track && <StatusDot status="live" label="live" />}
            {isLev && r.liquidated && <span className="badge neg">LIQUIDATED</span>}
          </p>
          <div className={`resultgrid hero ${pnlTone}`}>
            <div className="heroPnl">
              <span className="heroCur">{r.pnl > 0 ? "+$" : r.pnl < 0 ? "-$" : "$"}</span>
              <Private>
                <span className="heroNum">{fmt(Math.abs(r.pnl), 2)}</span>
              </Private>
              <span className="muted tiny"> Profit/Loss</span>
            </div>
            <div className="heroRoi">
              {fmtPct(r.roi, { dp: 1 })} <span className="muted tiny">ROI</span>
              {num(s.entry) > 0 && s.exit !== "" && (
                <span className={`chip ${signClass(r.move)}`}>
                  price {fmtPct(r.move)}
                </span>
              )}
            </div>
            <div className="equityLine">
              <span className="dim">
                <Private>{fmtUsd(s.invest)}</Private> <span className="muted tiny">Prev Equity</span>
              </span>
              <span className="arrow">→</span>
              <span className="bright">
                <Private>{fmtUsd(r.equity)}</Private> <span className="muted tiny">New Equity</span>
              </span>
            </div>
            {showLocal && (
              <>
                <hr className="solid" />
                <div className="localLine">
                  <Private>
                    {r.pnl > 0 ? "+" : ""}
                    {local(r.pnl)}
                  </Private>
                  <span className="muted tiny"> Profit/Loss</span>
                </div>
                <div className="equityLine small">
                  <span className="dim">
                    <Private>{local(s.invest)}</Private>
                  </span>
                  <span className="arrow">→</span>
                  <span className="bright">
                    <Private>{local(r.equity)}</Private>
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="statGrid">
            {isLev ? (
              <>
                <Row label="Position size">
                  <Private>{fmtUsd(r.size)}</Private>
                </Row>
                <Row label={`Qty (${s.asset || "tokens"})`}>{fmtToken(r.qty)}</Row>
                <Row label="Gross P&L" className={signClass(r.gross)}>
                  {fmtUsd(r.gross, { sign: true })}
                </Row>
                <Row label="Fees" className={r.fees ? "neg" : ""}>{fmtUsd(-r.fees, { dp: 3 })}</Row>
                <Row label="Funding" className={r.funding > 0 ? "neg" : "pos"}>
                  {r.funding > 0 ? "-" : "+"}
                  {fmtUsd(Math.abs(r.funding), { dp: 3 })}
                </Row>
                <Row label="Break-even" title="Exit price that covers fees and funding">
                  ${fmtPrice(r.breakEven)}
                </Row>
              </>
            ) : (
              <>
                <Row label={`Tokens received (${s.asset || "—"})`}>{fmtToken(r.tokens)}</Row>
                <Row label="Exit value">
                  <Private>{fmtUsd(r.exitValue)}</Private>
                </Row>
                <Row label="Gross P&L" className={signClass(r.gross)}>
                  {fmtUsd(r.gross, { sign: true })}
                </Row>
                <Row label="Fees" className={r.fees ? "neg" : ""}>{fmtUsd(-r.fees)}</Row>
                <Row label="Break-even" title="Sell price that covers fees">
                  ${fmtPrice(r.breakEven)}
                </Row>
                <Row label="Multiple">{num(s.invest) ? fmt(r.equity / num(s.invest), 3) : 0}x</Row>
              </>
            )}
          </div>

          {isLev && <LiquidationPanel s={s} r={r} />}
          {!isLev && <CompoundCard s={s} comp={comp} local={showLocal ? local : null} />}
        </div>
      </div>

      <div className="chartRow">
        <PayoffCard mode={mode} s={s} r={r} onPick={(price) => { setTrack(false); setS((c) => setExit(c, toNumStr(price, priceDecimals(price)))); }} />
        <ScenarioCard mode={mode} s={s} onPick={(pct) => { setTrack(false); setS((c) => setPct(c, String(pct))); }} />
      </div>
    </div>
  );
}

function LiquidationPanel({ s, r }) {
  const entry = num(s.entry);
  // Risk meter: how much of the distance to liquidation the planned move uses.
  const toLiq = Math.abs(r.liqDistance);
  const adverse = s.side === "short" ? Math.max(0, r.move) : Math.max(0, -r.move);
  const used = toLiq ? Math.min(100, (adverse / toLiq) * 100) : 0;
  return (
    <>
      <div className="reswrapper">
        <div className="reswrapperinner">
          <p className="outputLabel">Entry & Exit:</p>
          <div className="resultgrid compact">
            <span className="muted small">IN:</span>
            <span className="bright">{fmtPrice(entry)} $</span>
            <hr className="solid" />
            <span className="muted small">OUT:</span>
            <span className="bright">
              {fmtPrice(s.exit)} $ <span className={signClass(r.move)}>{fmtPct(r.move)}</span>
            </span>
          </div>
        </div>
        <div className="reswrapperinner">
          <p className="outputLabel">Liquid price:</p>
          <div className="resultgrid compact gold">
            <span className={`muted small ${s.side === "long" ? "sel" : ""}`}>Long ⬆</span>
            <span>{fmtPrice(r.liqLong)} $</span>
            <hr className="solid" />
            <span className={`muted small ${s.side === "short" ? "sel" : ""}`}>Short ⬇</span>
            <span>{fmtPrice(r.liqShort)} $</span>
          </div>
        </div>
      </div>
      {entry > 0 && (
        <div className="riskMeter" title="Share of the distance to liquidation used by the planned move">
          <div className="riskHead">
            <span>Distance to liquidation</span>
            <b>{fmtPct(Math.abs(r.liqDistance), { sign: false })}</b>
          </div>
          <div className="riskBar">
            <i style={{ width: `${used}%` }} className={used > 75 ? "neg" : used > 40 ? "warn" : "pos"} />
          </div>
        </div>
      )}
    </>
  );
}
