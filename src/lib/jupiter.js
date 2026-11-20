// Jupiter Price V3 + Tokens V2. Keyless use is limited to ~0.5 req/s, so every
// request goes through a limiter and token metadata is cached in IndexedDB.
import { chunk, getJson, rateLimiter, withRetry } from "./http";
import { idbGet, idbSet } from "./storage";
import { getSettings } from "./settingsStore";

const BASE = "https://api.jup.ag";
export const SOL_MINT = "So11111111111111111111111111111111111111112";

const headers = () => {
  const key = getSettings().jupiterKey;
  return key ? { "x-api-key": key } : undefined;
};
const limiter = rateLimiter(() => (getSettings().jupiterKey ? 1050 : 2100));
// Every Jupiter call is spaced by the limiter and retried on 429.
const limit = (fn) => withRetry(() => limiter(fn));

/** { [mint]: { usdPrice, priceChange24h, decimals } } */
export async function jupPrices(mints) {
  const out = {};
  const unique = [...new Set(mints)].filter(Boolean);
  for (const group of chunk(unique, 50)) {
    const res = await limit(() =>
      getJson(`${BASE}/price/v3?ids=${group.join(",")}`, { headers: headers() })
    );
    Object.assign(out, res);
  }
  return out;
}

let metaMem = null;
const META_KEY = "tokenMeta.v1";

async function loadMeta() {
  if (!metaMem) metaMem = (await idbGet(META_KEY, {})) || {};
  return metaMem;
}

/** Cached token metadata: { [mint]: { symbol, name, icon, decimals, verified } } */
export async function jupTokenMeta(mints) {
  const meta = await loadMeta();
  const missing = [...new Set(mints)].filter((m) => m && !meta[m]);
  for (const group of chunk(missing, 100)) {
    try {
      const res = await limit(() =>
        getJson(`${BASE}/tokens/v2/search?query=${group.join(",")}`, { headers: headers() })
      );
      for (const t of res || []) {
        meta[t.id] = {
          symbol: t.symbol,
          name: t.name,
          icon: t.icon,
          decimals: t.decimals,
          verified: !!t.isVerified,
          sus: !!t.audit?.isSus,
        };
      }
      // Remember unknown mints too, so we don't re-query them every refresh.
      for (const m of group) if (!meta[m]) meta[m] = { symbol: m.slice(0, 4), name: "Unknown token", unknown: true };
    } catch {
      break;
    }
  }
  if (missing.length) idbSet(META_KEY, meta);
  return meta;
}

/**
 * Wallet balances from Jupiter (keyless). Used when the Solana RPC refuses
 * getTokenAccountsByOwner, which most free public RPCs now do.
 * Returns { lamports, tokens: { [mint]: uiAmount } }.
 */
export async function jupHoldings(address) {
  const res = await limit(() => getJson(`${BASE}/ultra/v1/holdings/${address}`, { headers: headers() }));
  const tokens = {};
  for (const [mint, accounts] of Object.entries(res?.tokens || {})) {
    const ui = (accounts || []).reduce((s, a) => s + Number(a.uiAmountString ?? a.uiAmount ?? 0), 0);
    if (ui > 0) tokens[mint] = ui;
  }
  return { lamports: Number(res?.amount || 0), tokens };
}
