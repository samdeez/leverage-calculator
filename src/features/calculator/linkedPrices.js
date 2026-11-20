// Entry / exit / % change are three views of the same trade. Whichever of exit
// or % change the user edited last is the "anchor": it is stored exactly as
// typed, and only the *other* field is recomputed. The field under the cursor
// is never rewritten, which is what stops the inputs from jumping.
import { num, pctChange, priceDecimals, priceFromPct, toNumStr } from "../../lib/math";

const derivePct = (entry, exit) => (num(entry) && exit !== "" ? toNumStr(pctChange(entry, exit), 2) : "");
const deriveExit = (entry, pct) => {
  if (!num(entry) || pct === "" || pct === "-") return "";
  const p = priceFromPct(entry, pct);
  return toNumStr(p, priceDecimals(p));
};

export function setEntry(state, entry) {
  return state.anchor === "pct"
    ? { ...state, entry, exit: deriveExit(entry, state.pct) }
    : { ...state, entry, pct: derivePct(entry, state.exit) };
}

export function setExit(state, exit) {
  return { ...state, exit, anchor: "exit", pct: derivePct(state.entry, exit) };
}

export function setPct(state, pct) {
  return { ...state, pct, anchor: "pct", exit: deriveExit(state.entry, pct) };
}
