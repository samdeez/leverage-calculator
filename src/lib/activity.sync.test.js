import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchEvents } from "./activity";
import { setSettings } from "./settingsStore";

const OWNER = "Owner111111111111111111111111111111111111111";
const tx = (t) => ({
  blockTime: t,
  transaction: { message: { accountKeys: [OWNER] } },
  meta: { err: null, fee: 5000, preBalances: [2e9], postBalances: [1e9], preTokenBalances: [], postTokenBalances: [] },
});
const json = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

/** Fake Solana RPC: `onTx(sig, isBatch)` decides each getTransaction answer. */
function fakeRpc(onTx, sigs = ["s1", "s2"]) {
  return vi.fn((url, init) => {
    if (!String(url).includes("rpc")) return json({}); // Jupiter metadata/prices
    const body = JSON.parse(init.body);
    const calls = Array.isArray(body) ? body : [body];
    if (calls[0].method === "getSignaturesForAddress") return json({ jsonrpc: "2.0", id: 1, result: sigs.map((signature) => ({ signature })) });
    const out = calls.map((c) => ({ jsonrpc: "2.0", id: c.id, ...onTx(c.params[0], Array.isArray(body)) }));
    if (out.some((o) => o.httpStatus)) return json({ error: "x" }, out[0].httpStatus);
    return json(Array.isArray(body) ? out : out[0]);
  });
}

describe("Solana activity sync", () => {
  afterEach(() => vi.unstubAllGlobals());
  setSettings({ solanaRpc: "https://rpc.test" });
  const wallet = { family: "solana", address: OWNER };

  it("falls back to single requests when batches are refused (HTTP 400)", async () => {
    vi.stubGlobal("fetch", fakeRpc((sig, batch) => (batch ? { httpStatus: 400 } : { result: tx(sig === "s1" ? 2 : 1) })));
    const { events, stats } = await fetchEvents(wallet);
    expect(events).toHaveLength(2);
    expect(stats.loaded).toBe(2);
  });

  it("handles batch limits reported as per-item errors with HTTP 200", async () => {
    setSettings({ solanaRpc: "https://rpc2.test" });
    vi.stubGlobal("fetch", fakeRpc((sig, batch) => (batch ? { error: { message: "Too many requests in batch" } } : { result: tx(1) })));
    const { events } = await fetchEvents(wallet);
    expect(events).toHaveLength(2);
  });

  it("throws instead of reporting an empty wallet when every transaction fails", async () => {
    setSettings({ solanaRpc: "https://rpc3.test" });
    vi.stubGlobal("fetch", fakeRpc((sig, batch) => (batch ? { httpStatus: 400 } : { error: { code: 429, message: "rate limited" } })));
    await expect(fetchEvents(wallet)).rejects.toThrow(/rate limited/);
  }, 15000);

  it("keeps partial results and reports a warning", async () => {
    setSettings({ solanaRpc: "https://rpc4.test" });
    vi.stubGlobal("fetch", fakeRpc((sig, batch) => (batch ? { httpStatus: 400 } : sig === "s1" ? { result: tx(1) } : { error: { message: "boom" } })));
    const { events, stats } = await fetchEvents(wallet);
    expect(events).toHaveLength(1);
    expect(stats.warning).toMatch(/1 of 2/);
  }, 15000);
});
