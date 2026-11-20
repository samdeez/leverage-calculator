import { describe, expect, it } from "vitest";
import { setEntry, setExit, setPct } from "../features/calculator/linkedPrices";
import { comboFromEvent } from "../hooks/useHotkeys";
import { detectChain } from "./chains";
import { hexToAmount } from "./chains/evm";
import { addSnapshot, compact, seriesFor, seriesStats } from "./history";

describe("linked entry / exit / % change", () => {
  const base = { entry: "88", exit: "", pct: "", anchor: "exit" };
  it("keeps % change exactly as typed and derives exit", () => {
    let s = setPct(base, "-");
    expect(s.pct).toBe("-");
    expect(s.exit).toBe("");
    s = setPct(s, "-5.");
    expect(s.pct).toBe("-5.");
    s = setPct(s, "-5.5");
    expect(s.pct).toBe("-5.5");
    expect(s.exit).toBe("83.16");
  });
  it("keeps exit exactly as typed and derives %", () => {
    const s = setExit(base, "100.");
    expect(s.exit).toBe("100.");
    expect(s.pct).toBe("13.64");
  });
  it("entry change keeps the anchored field", () => {
    expect(setEntry(setExit(base, "110"), "100").pct).toBe("10");
    expect(setEntry(setPct(base, "10"), "100").exit).toBe("110");
  });
});

describe("detectChain", () => {
  it("recognises address families", () => {
    expect(detectChain("vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg")).toBe("solana");
    expect(detectChain("0x742d35Cc6634C0532925a3b844Bc454e4438f44e")).toBe("evm");
    expect(detectChain("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")).toBe("bitcoin");
    expect(detectChain("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBe("bitcoin");
    expect(detectChain("toly.sol")).toBe("solana");
    expect(detectChain("hello")).toBe(null);
  });
  it("converts hex balances", () => {
    expect(hexToAmount("0xde0b6b3a7640000", 18)).toBe(1);
    expect(hexToAmount("0x0", 6)).toBe(0);
    expect(hexToAmount("0x", 6)).toBe(0);
  });
});

describe("history", () => {
  it("only appends once the snapshot gap has passed", () => {
    let h = [];
    h = addSnapshot(h, { t: 0, total: 1 }, 100);
    h = addSnapshot(h, { t: 10, total: 2 }, 100);
    expect(h).toEqual([{ t: 0, total: 1 }]);
    h = addSnapshot(h, { t: 150, total: 4 }, 100);
    expect(h).toHaveLength(2);
  });
  it("compacts old points", () => {
    const list = Array.from({ length: 10 }, (_, i) => ({ t: i, total: i }));
    expect(compact(list)).toHaveLength(8);
  });
  it("filters ranges and computes stats", () => {
    const now = 10 * 864e5;
    const h = [{ t: 0, total: 100 }, { t: now - 1000, total: 150, wallets: { a: 50 } }];
    expect(seriesFor(h, { range: "1D", now })).toHaveLength(1);
    expect(seriesFor(h, { range: "ALL", walletId: "a", now })).toEqual([{ x: now - 1000, y: 50 }]);
    expect(seriesStats(seriesFor(h, { now })).changePct).toBe(50);
  });
});

describe("hotkeys", () => {
  it("normalises key events", () => {
    expect(comboFromEvent({ key: "?", shiftKey: true })).toBe("?");
    expect(comboFromEvent({ key: "R", shiftKey: true })).toBe("shift+r");
    expect(comboFromEvent({ key: "¡", code: "Digit1", altKey: true })).toBe("alt+1");
    expect(comboFromEvent({ key: "!", code: "Digit1", shiftKey: true })).toBe("shift+1");
  });
});
