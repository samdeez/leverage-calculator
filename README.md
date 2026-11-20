# Leverage Calculator

A crypto trading calculator and multi-chain portfolio tracker built with React + Vite. Everything runs in the browser, and wallets, balances and history are stored locally (IndexedDB).

## Features

**Spot & Leverage calculators**
- Linked entry / exit / % change fields. The field you are typing in is never rewritten.
- Long/short, leverage slider, round-trip fees, funding, maintenance margin, liquidation and break-even prices, distance-to-liquidation meter
- Interactive P&L-vs-exit-price chart (click or drag to set the exit) and a clickable scenario table
- Compound growth chart (spot)
- Live prices: **Live** (`P`) fills the entry price and **Track** (`T`) makes the exit follow the market in real time
- Results in USD and a configurable local currency
- Share links (`C`), save to journal (`J`), and inputs that persist across reloads

**Portfolio**
- Multiple wallets on **Solana**, EVM chains (Ethereum, Base, Arbitrum, Optimism, BNB Chain, Polygon) and Bitcoin. The chain is detected from the address, and `.sol` names are resolved.
- Solana balances update live over the RPC WebSocket (`accountSubscribe` + `logsSubscribe`), and major-asset prices stream from an exchange WebSocket
- Balances are cached in IndexedDB, so the page renders straight away and refreshes in the background
- Value history snapshots with 1D/1W/1M/3M/ALL charts, per wallet or in total
- Allocation donut by asset, chain or wallet; a sortable and searchable holdings table; recent activity
- Wallets can be renamed, reordered or excluded from the total, and any holding can be opened in the calculator

**Tools**: risk-based position sizing (R:R, required leverage), DCA averaging, a trade journal with CSV export, and price alerts (in-app and browser notifications).

**Keyboard**: press `?` to see every shortcut. `1`–`4` switch tabs, and `↑`/`↓` step any number input (`Shift` ×10, `Alt` ×0.1). `Enter` moves to the next field and `H` turns on privacy mode. Hint badges can be switched off in Settings (`,`).

## Data sources

| Data | Source |
| --- | --- |
| Solana balances | Your RPC (default: publicnode). Falls back to Jupiter holdings when the RPC blocks token queries |
| Solana prices / token info | Jupiter Price V3 + Tokens V2 (keyless by default, optional API key in Settings) |
| Live ticks | Coinbase WebSocket, then OKX, then polling Jupiter/CoinGecko |
| EVM | publicnode JSON-RPC + CoinGecko |
| Bitcoin | mempool.space + CoinGecko |

The fastest Solana updates come from your own RPC (Helius, Triton, QuickNode…): set it under Settings, then Solana.

## Development

```bash
npm install
npm start        # dev server
npm test         # vitest
npm run build    # production build in build/
```
