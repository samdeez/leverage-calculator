// EVM chains: native + major stablecoin balances via public JSON-RPC (batched).
import { getJson } from "../http";

export const EVM_CHAINS = [
  {
    key: "ethereum", name: "Ethereum", symbol: "ETH", cg: "ethereum", live: "ETH",
    rpc: "https://ethereum-rpc.publicnode.com", explorer: "https://etherscan.io/address/",
    tokens: [
      { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, cg: "usd-coin" },
      { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, cg: "tether" },
    ],
  },
  {
    key: "base", name: "Base", symbol: "ETH", cg: "ethereum", live: "ETH",
    rpc: "https://base-rpc.publicnode.com", explorer: "https://basescan.org/address/",
    tokens: [{ symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, cg: "usd-coin" }],
  },
  {
    key: "arbitrum", name: "Arbitrum", symbol: "ETH", cg: "ethereum", live: "ETH",
    rpc: "https://arbitrum-one-rpc.publicnode.com", explorer: "https://arbiscan.io/address/",
    tokens: [
      { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6, cg: "usd-coin" },
      { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6, cg: "tether" },
    ],
  },
  {
    key: "optimism", name: "Optimism", symbol: "ETH", cg: "ethereum", live: "ETH",
    rpc: "https://optimism-rpc.publicnode.com", explorer: "https://optimistic.etherscan.io/address/",
    tokens: [{ symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6, cg: "usd-coin" }],
  },
  {
    key: "bsc", name: "BNB Chain", symbol: "BNB", cg: "binancecoin", live: "BNB",
    rpc: "https://bsc-rpc.publicnode.com", explorer: "https://bscscan.com/address/",
    tokens: [
      { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, cg: "tether" },
      { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18, cg: "usd-coin" },
    ],
  },
  {
    key: "polygon", name: "Polygon", symbol: "POL", cg: "polygon-ecosystem-token", live: "POL",
    rpc: "https://polygon-bor-rpc.publicnode.com", explorer: "https://polygonscan.com/address/",
    tokens: [{ symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6, cg: "usd-coin" }],
  },
];

/** Convert a hex wei-style integer to a float with `decimals`. */
export function hexToAmount(hex, decimals) {
  if (!hex || hex === "0x") return 0;
  const big = BigInt(hex);
  const base = 10n ** BigInt(decimals);
  const whole = big / base;
  const frac = big % base;
  return Number(whole) + Number(frac) / Number(base);
}

const balanceOfData = (addr) => `0x70a08231${addr.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;

async function chainBalances(chain, address) {
  const calls = [
    { jsonrpc: "2.0", id: 0, method: "eth_getBalance", params: [address, "latest"] },
    ...chain.tokens.map((t, i) => ({
      jsonrpc: "2.0",
      id: i + 1,
      method: "eth_call",
      params: [{ to: t.address, data: balanceOfData(address) }, "latest"],
    })),
  ];
  const res = await fetch(chain.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(calls),
  }).then((r) => {
    if (!r.ok) throw new Error(`${chain.name} RPC ${r.status}`);
    return r.json();
  });
  const byId = Object.fromEntries((Array.isArray(res) ? res : [res]).map((r) => [r.id, r.result]));
  return [
    { symbol: chain.symbol, name: chain.name === "Ethereum" ? "Ether" : `${chain.symbol} (${chain.name})`, cg: chain.cg, live: chain.live, assetId: "native", amount: hexToAmount(byId[0], 18) },
    ...chain.tokens.map((t, i) => ({ symbol: t.symbol, name: `${t.symbol} (${chain.name})`, cg: t.cg, assetId: t.address, amount: hexToAmount(byId[i + 1], t.decimals) })),
  ];
}

let cgCache = { t: 0, ids: "", data: {} };
export async function coingeckoPrices(ids) {
  const key = [...new Set(ids)].sort().join(",");
  if (cgCache.ids === key && Date.now() - cgCache.t < 60000) return cgCache.data;
  const data = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${key}&vs_currencies=usd&include_24hr_change=true`);
  cgCache = { t: Date.now(), ids: key, data };
  return data;
}

export async function fetchEvmWallet(address, chainKeys) {
  const chains = EVM_CHAINS.filter((c) => !chainKeys?.length || chainKeys.includes(c.key));
  const results = await Promise.allSettled(chains.map((c) => chainBalances(c, address)));
  const rows = [];
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") rows.push(...r.value.filter((x) => x.amount > 0).map((x) => ({ ...x, chain: chains[i].key })));
    else errors.push(r.reason?.message || chains[i].name);
  });
  if (errors.length === chains.length) throw new Error(errors[0] || "All EVM RPCs failed");
  const prices = rows.length ? await coingeckoPrices(rows.map((r) => r.cg)).catch(() => ({})) : {};
  const holdings = rows.map((r) => {
    const p = prices[r.cg];
    return {
      id: `${r.chain}:${r.assetId}`,
      chain: r.chain,
      assetId: r.assetId,
      symbol: r.symbol,
      name: r.name,
      verified: true,
      priced: !!p,
      amount: r.amount,
      price: p?.usd ?? 0,
      value: r.amount * (p?.usd ?? 0),
      change24h: p?.usd_24h_change ?? null,
      liveSymbol: r.live,
    };
  });
  return { holdings, warnings: errors };
}
