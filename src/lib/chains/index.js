import { EVM_CHAINS, fetchEvmWallet } from "./evm";
import { fetchBitcoinWallet } from "./bitcoin";
import { fetchSolanaWallet, resolveSolDomain } from "./solana";

export const CHAIN_FAMILIES = {
  solana: { label: "Solana", short: "SOL", color: "#9a7cd8", explorer: "https://solscan.io/account/" },
  evm: { label: "EVM", short: "EVM", color: "#6f8fd8", explorer: "https://debank.com/profile/" },
  bitcoin: { label: "Bitcoin", short: "BTC", color: "#d8953c", explorer: "https://mempool.space/address/" },
};

export const CHAIN_NAMES = {
  solana: "Solana",
  bitcoin: "Bitcoin",
  ...Object.fromEntries(EVM_CHAINS.map((c) => [c.key, c.name])),
};

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

/** Guess the chain family from an address. Returns null if unrecognized. */
export function detectChain(input) {
  const a = String(input || "").trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(a)) return "evm";
  if (/\.sol$/i.test(a)) return "solana";
  if (/^bc1[02-9ac-hj-np-z]{11,71}$/i.test(a)) return "bitcoin";
  if (BASE58.test(a) && a.length >= 32 && a.length <= 44) {
    // Legacy BTC addresses are 26–34 chars starting with 1 or 3; Solana keys are usually 43–44.
    if (a.length <= 34 && /^[13]/.test(a)) return "bitcoin";
    return "solana";
  }
  if (BASE58.test(a) && a.length >= 26 && a.length <= 34 && /^[13]/.test(a)) return "bitcoin";
  return null;
}

/** Normalize user input (resolves .sol domains). */
export async function resolveAddress(input, family) {
  const a = input.trim();
  if (family === "solana" && /\.sol$/i.test(a)) return resolveSolDomain(a);
  return a;
}

export async function fetchWallet(wallet) {
  switch (wallet.family) {
    case "solana":
      return fetchSolanaWallet(wallet.address);
    case "evm":
      return fetchEvmWallet(wallet.address, wallet.chains);
    case "bitcoin":
      return fetchBitcoinWallet(wallet.address);
    default:
      throw new Error(`Unsupported chain ${wallet.family}`);
  }
}
