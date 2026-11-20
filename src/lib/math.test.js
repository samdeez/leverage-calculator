import { describe, expect, it } from "vitest";
import {
  autoStep,
  compound,
  dcaAverage,
  leverageTrade,
  liquidationPrice,
  pctChange,
  positionSize,
  spotTrade,
  toNumStr,
} from "./math";

describe("spotTrade", () => {
  it("computes pnl, tokens and break-even", () => {
    const r = spotTrade({ invest: 200, entry: 100, exit: 110, feePct: 0 });
    expect(r.tokens).toBe(2);
    expect(r.pnl).toBeCloseTo(20);
    expect(r.roi).toBeCloseTo(10);
    expect(r.breakEven).toBe(100);
  });
  it("charges fees on the invested amount", () => {
    const r = spotTrade({ invest: 1000, entry: 10, exit: 10, feePct: 0.5 });
    expect(r.pnl).toBeCloseTo(-5);
    expect(r.breakEven).toBeCloseTo(10.05);
  });
  it("is zero when the exit is empty or entry is 0", () => {
    expect(spotTrade({ invest: 200, entry: 88, exit: "" }).pnl).toBe(0);
    expect(spotTrade({ invest: 200, entry: 0, exit: 5 }).tokens).toBe(0);
  });
});

describe("compound", () => {
  it("matches the original compound behaviour", () => {
    expect(compound(1000, 5, 3).profit).toBeCloseTo(157.625);
    expect(compound(400, 7.5, 20).profit).toBeCloseTo(1299.14, 1);
    expect(compound(1000, -10, 2).profit).toBeCloseTo(-190);
  });
  it("caps the chart series", () => {
    const r = compound(100, 1, 5000);
    expect(r.series.length).toBeLessThanOrEqual(402);
    expect(r.series.at(-1).x).toBe(5000);
  });
});

describe("leverage", () => {
  it("keeps the original liquidation formulas when MMR is 0", () => {
    expect(liquidationPrice(12000, 6, "short")).toBe(14000);
    expect(liquidationPrice(10000, 2, "short")).toBe(15000);
    expect(liquidationPrice(12000, 6, "long")).toBe(10000);
  });
  it("tightens liquidation with maintenance margin", () => {
    expect(liquidationPrice(100, 10, "long", 0.5)).toBeCloseTo(90.5);
    expect(liquidationPrice(100, 10, "short", 0.5)).toBeCloseTo(109.5);
  });
  it("computes long pnl with fees and funding like before", () => {
    const r = leverageTrade({ collateral: 100, entry: 100, exit: 110, leverage: 5, feePct: 0.2, fundingPct: 0.01, hours: 10 });
    expect(r.size).toBe(500);
    expect(r.gross).toBeCloseTo(50);
    expect(r.fees).toBeCloseTo(1);
    expect(r.funding).toBeCloseTo(0.5);
    expect(r.pnl).toBeCloseTo(48.5);
  });
  it("supports shorts", () => {
    const r = leverageTrade({ collateral: 100, entry: 100, exit: 90, leverage: 5, side: "short" });
    expect(r.pnl).toBeCloseTo(50);
  });
  it("caps losses at the collateral when liquidated", () => {
    const r = leverageTrade({ collateral: 100, entry: 100, exit: 70, leverage: 5 });
    expect(r.liquidated).toBe(true);
    expect(r.pnl).toBe(-100);
  });
  it("does not divide by zero", () => {
    const r = leverageTrade({ collateral: 100, entry: "", exit: 10, leverage: 5 });
    expect(r.pnl).toBe(0);
    expect(Number.isFinite(r.liq)).toBe(true);
  });
});

describe("tools", () => {
  it("sizes a position from risk", () => {
    const r = positionSize({ account: 1000, riskPct: 1, entry: 100, stop: 95, target: 115 });
    expect(r.riskAmount).toBe(10);
    expect(r.qty).toBe(2);
    expect(r.size).toBe(200);
    expect(r.rr).toBeCloseTo(3);
    expect(r.side).toBe("long");
  });
  it("averages DCA buys", () => {
    const r = dcaAverage([{ price: 100, amount: 100 }, { price: 50, amount: 100 }]);
    expect(r.qty).toBeCloseTo(3);
    expect(r.avg).toBeCloseTo(66.667, 2);
  });
});

describe("helpers", () => {
  it("pctChange / autoStep / toNumStr", () => {
    expect(pctChange(0, 5)).toBe(0);
    expect(pctChange(80, 100)).toBe(25);
    expect(autoStep(88)).toBeCloseTo(0.1);
    expect(autoStep(72000)).toBe(100);
    expect(toNumStr(0.1 + 0.2, 8)).toBe("0.3");
  });
});
