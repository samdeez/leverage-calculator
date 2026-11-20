import { describe, expect, it } from "vitest";
import { classify, mergeEvents, parseBitcoinTx, parseEvmActivity, parseSolanaTx, reconstructSeries } from "./activity";

const OWNER = "Owner111111111111111111111111111111111111111";
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const bal = (mint, owner, ui) => ({ mint, owner, uiTokenAmount: { uiAmountString: String(ui) } });

describe("parseSolanaTx", () => {
  it("detects a SOL → USDC swap, excluding the fee", () => {
    const tx = {
      blockTime: 1000,
      transaction: { message: { accountKeys: [{ pubkey: OWNER }, { pubkey: "Pool" }] } },
      meta: {
        err: null,
        fee: 5000,
        preBalances: [2_000_000_000, 0],
        postBalances: [999_995_000, 0],
        preTokenBalances: [bal(USDC, OWNER, 10)],
        postTokenBalances: [bal(USDC, OWNER, 150)],
      },
    };
    const e = parseSolanaTx(tx, OWNER, "sig1");
    expect(e.kind).toBe("swap");
    expect(e.fee).toBeCloseTo(0.000005);
    const sol = e.changes.find((c) => c.assetId === SOL);
    const usdc = e.changes.find((c) => c.assetId === USDC);
    expect(sol.amount).toBeCloseTo(-1);
    expect(usdc.amount).toBeCloseTo(140);
    expect(e.time).toBe(1_000_000);
  });

  it("drops token-account rent next to a token transfer", () => {
    const tx = {
      blockTime: 1,
      transaction: { message: { accountKeys: [OWNER] } },
      meta: {
        err: null,
        fee: 5000,
        preBalances: [1_000_000_000],
        postBalances: [1_000_000_000 - 5000 - 2_039_280],
        preTokenBalances: [],
        postTokenBalances: [bal(USDC, OWNER, 25)],
      },
    };
    const e = parseSolanaTx(tx, OWNER, "sig2");
    expect(e.kind).toBe("receive");
    expect(e.changes).toHaveLength(1);
  });

  it("classifies a same-token DEX round trip as an arbitrage with its route", () => {
    const tx = {
      blockTime: 5,
      transaction: { message: { accountKeys: [OWNER], instructions: [{ programId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4" }] } },
      meta: {
        err: null,
        fee: 5000,
        preBalances: [1_000_000_000],
        postBalances: [1_000_000_000 - 5000],
        preTokenBalances: [bal(SOL, OWNER, 10), bal(USDC, OWNER, 2)],
        postTokenBalances: [bal(SOL, OWNER, 10.004), bal(USDC, OWNER, 2)],
      },
    };
    const e = parseSolanaTx(tx, OWNER, "arb1");
    expect(e.kind).toBe("arb");
    expect(e.changes).toHaveLength(1);
    expect(e.changes[0].amount).toBeCloseTo(0.004);
    expect(e.route).toEqual([SOL, USDC]);
  });

  it("detects DEX trades from instruction logs too", () => {
    const tx = {
      blockTime: 5,
      transaction: { message: { accountKeys: [OWNER], instructions: [{ programId: "SomeArbBot111" }] } },
      meta: {
        err: null,
        fee: 5000,
        preBalances: [2e9],
        postBalances: [2e9 - 15000],
        preTokenBalances: [bal(SOL, OWNER, 1), bal(USDC, OWNER, 5)],
        postTokenBalances: [bal(SOL, OWNER, 1.01), bal(USDC, OWNER, 5)],
        logMessages: ["Program log: Instruction: Swap"],
      },
    };
    expect(parseSolanaTx(tx, OWNER, "x").kind).toBe("arb");
  });

  it("does not call a one-token outflow through a DEX program an arbitrage", () => {
    const tx = {
      blockTime: 5,
      transaction: { message: { accountKeys: [OWNER], instructions: [{ programId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4" }] } },
      meta: { err: null, fee: 5000, preBalances: [2e9], postBalances: [2e9 - 5000], preTokenBalances: [bal(USDC, OWNER, 30)], postTokenBalances: [bal(USDC, OWNER, 0.6)] },
    };
    expect(parseSolanaTx(tx, OWNER, "x").kind).toBe("send");
  });

  it("marks failed transactions", () => {
    const tx = { blockTime: 1, transaction: { message: { accountKeys: [OWNER] } }, meta: { err: { x: 1 }, fee: 5000, preBalances: [10], postBalances: [5] } };
    expect(parseSolanaTx(tx, OWNER, "s").kind).toBe("failed");
  });
});

describe("parseBitcoinTx", () => {
  it("computes a send net of fee", () => {
    const t = {
      txid: "t1",
      fee: 1000,
      status: { confirmed: true, block_time: 10 },
      vin: [{ prevout: { scriptpubkey_address: "me", value: 100000 } }],
      vout: [
        { scriptpubkey_address: "other", value: 60000 },
        { scriptpubkey_address: "me", value: 39000 },
      ],
    };
    const e = parseBitcoinTx(t, "me");
    expect(e.kind).toBe("send");
    expect(e.changes[0].amount).toBeCloseTo(-0.0006);
    expect(e.fee).toBeCloseTo(0.00001);
  });
});

describe("parseEvmActivity", () => {
  it("groups native and token transfers by tx hash", () => {
    const me = "0xAbC0000000000000000000000000000000000001";
    const txs = [{ hash: "0x1", timestamp: "2026-01-01T00:00:00Z", from: { hash: me }, to: { hash: "0xrouter" }, value: "1000000000000000000", fee: { value: "21000000000000" }, status: "ok" }];
    const transfers = [
      { transaction_hash: "0x1", timestamp: "2026-01-01T00:00:00Z", token_type: "ERC-20", from: { hash: "0xrouter" }, to: { hash: me.toLowerCase() }, total: { value: "2500000000", decimals: "6" }, token: { address_hash: "0xUSDC", symbol: "USDC", exchange_rate: "1" } },
    ];
    const [e] = parseEvmActivity("ethereum", me, txs, transfers);
    expect(e.kind).toBe("swap");
    expect(e.changes.find((c) => c.symbol === "ETH").amount).toBe(-1);
    expect(e.changes.find((c) => c.symbol === "USDC").amount).toBe(2500);
    expect(e.fee).toBeCloseTo(0.000021);
  });
});

describe("reconstructSeries", () => {
  const priceOf = (k) => ({ "solana:sol": 100, "solana:usdc": 1 })[k];
  const events = [
    { id: "a", time: 100, kind: "receive", fee: 0, feeKey: "solana:sol", changes: [{ key: "solana:sol", amount: 2 }] },
    { id: "b", time: 200, kind: "swap", fee: 0, feeKey: "solana:sol", changes: [{ key: "solana:sol", amount: -1 }, { key: "solana:usdc", amount: 120 }] },
  ];
  it("walks back from the current total in activity mode", () => {
    const pts = reconstructSeries(events, { total: 1000, priceOf, mode: "activity", now: 300 });
    expect(pts.at(-1)).toEqual({ x: 300, y: 1000 });
    // before the swap: 1000 - 20 = 980; before the receive: 980 - 200 = 780
    expect(pts[0].y).toBe(780);
    expect(pts.map((p) => p.y)).toContain(980);
  });
  it("counts arbitrage results and fees in trades mode", () => {
    const arb = { id: "c", time: 250, kind: "arb", fee: 0.01, feeKey: "solana:sol", changes: [{ key: "solana:sol", amount: 0.05 }] };
    const pts = reconstructSeries([...events, arb], { total: 1000, priceOf, mode: "trades", now: 300 });
    // arb: +5 − 1 fee = +4; swap: +20  → start = 1000 − 4 − 20
    expect(pts[0].y).toBeCloseTo(976);
  });

  it("only moves on swaps in trades mode", () => {
    const pts = reconstructSeries(events, { total: 1000, priceOf, mode: "trades", now: 300 });
    expect(pts[0].y).toBe(980);
    expect(pts).toHaveLength(3);
  });
});

describe("helpers", () => {
  it("classifies and merges", () => {
    expect(classify([{ amount: 1 }, { amount: -1 }])).toBe("swap");
    expect(classify([])).toBe("other");
    const merged = mergeEvents([{ id: "a", time: 1 }], [{ id: "a", time: 1, x: 1 }, { id: "b", time: 2 }]);
    expect(merged.map((e) => e.id)).toEqual(["b", "a"]);
    expect(merged[1].x).toBe(1);
  });
});
