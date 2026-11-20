// Bitcoin via the public mempool.space API.
import { getJson } from "../http";
import { coingeckoPrices } from "./evm";

const API = "https://mempool.space/api";

export async function fetchBitcoinWallet(address) {
  const [info, prices] = await Promise.all([
    getJson(`${API}/address/${address}`),
    coingeckoPrices(["bitcoin"]).catch(() => ({})),
  ]);
  const c = info.chain_stats || {};
  const m = info.mempool_stats || {};
  const sats = c.funded_txo_sum - c.spent_txo_sum + (m.funded_txo_sum - m.spent_txo_sum);
  const amount = sats / 1e8;
  const p = prices.bitcoin;
  return {
    holdings: [
      {
        id: "bitcoin:native",
        chain: "bitcoin",
        assetId: "native",
        symbol: "BTC",
        name: "Bitcoin",
        verified: true,
        priced: !!p,
        amount,
        price: p?.usd ?? 0,
        value: amount * (p?.usd ?? 0),
        change24h: p?.usd_24h_change ?? null,
        liveSymbol: "BTC",
      },
    ],
  };
}
