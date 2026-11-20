import React, { useRef } from "react";
import { useToast } from "../context/Toast";
import { cacheStore, historyStore, walletsStore } from "../context/Portfolio";
import { solanaSocket } from "../lib/chains/solana";
import { alertsStore, journalStore } from "../lib/idbStore";
import { liveFeed } from "../lib/live";
import { DEFAULT_SETTINGS, resetSettings, setSettings, useSettings } from "../lib/settingsStore";
import NumberField from "./NumberField";
import { Field, Modal } from "./ui";

export default function SettingsModal({ onClose }) {
  const s = useSettings();
  const toast = useToast();
  const fileRef = useRef(null);

  const exportData = () => {
    const data = {
      app: "levcal",
      version: 2,
      exportedAt: new Date().toISOString(),
      settings: { ...s, jupiterKey: "" },
      wallets: walletsStore.get(),
      history: historyStore.get(),
      journal: journalStore.get(),
      alerts: alertsStore.get(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `levcal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== "levcal") throw new Error("Not a levcal backup");
      if (Array.isArray(data.wallets)) walletsStore.set(data.wallets);
      if (Array.isArray(data.history)) historyStore.set(data.history);
      if (Array.isArray(data.journal)) journalStore.set(data.journal);
      if (Array.isArray(data.alerts)) alertsStore.set(data.alerts);
      if (data.settings) setSettings({ ...data.settings, jupiterKey: s.jupiterKey });
      toast("Backup restored", "ok");
    } catch (e) {
      toast(e.message || "Import failed", "warn");
    }
  };

  const text = (key, props = {}) => (
    <input className="input wide" value={s[key] ?? ""} onChange={(e) => setSettings({ [key]: e.target.value })} spellCheck={false} {...props} />
  );

  return (
    <Modal title="Settings" onClose={onClose} wide>
      <div className="settingsGrid" data-fieldgroup>
        <section>
          <h4>Display</h4>
          <Field label="Local currency:" suffix="">
            {text("localSymbol", { maxLength: 6, "aria-label": "Local currency symbol" })}
          </Field>
          <Field label="1 USD =" suffix={s.localSymbol}>
            <NumberField value={String(s.localRate ?? "")} onChange={(v) => setSettings({ localRate: v })} step={1000} aria-label="Local rate" />
          </Field>
          <label className="check">
            <input type="checkbox" checked={s.showLocal} onChange={(e) => setSettings({ showLocal: e.target.checked })} /> Show local currency
          </label>
          <label className="check">
            <input type="checkbox" checked={s.showHints} onChange={(e) => setSettings({ showHints: e.target.checked })} /> Show keyboard hint badges
          </label>
          <label className="check">
            <input type="checkbox" checked={s.privacy} onChange={(e) => setSettings({ privacy: e.target.checked })} /> Privacy mode (blur balances)
          </label>
        </section>

        <section>
          <h4>Live data</h4>
          <Field label="Price stream:" suffix="">
            <select
              className="input"
              value={s.priceSource}
              onChange={(e) => {
                setSettings({ priceSource: e.target.value });
                liveFeed.restart();
              }}
              aria-label="Price source"
            >
              <option value="auto">Auto (Coinbase → OKX → poll)</option>
              <option value="coinbase">Coinbase WebSocket</option>
              <option value="okx">OKX WebSocket</option>
              <option value="poll">Polling only (Jupiter / CoinGecko)</option>
            </select>
          </Field>
          <Field label="Wallet refresh:" suffix="s">
            <NumberField value={String(s.refreshSec)} onChange={(v) => setSettings({ refreshSec: v })} step={5} min={10} aria-label="Refresh seconds" />
          </Field>
          <Field label="History every:" suffix="min">
            <NumberField value={String(s.snapshotMin)} onChange={(v) => setSettings({ snapshotMin: v })} step={1} min={1} aria-label="Snapshot minutes" />
          </Field>
          <Field label="Hide below:" suffix="$">
            <NumberField value={String(s.dustUsd)} onChange={(v) => setSettings({ dustUsd: v })} step={1} aria-label="Dust threshold" />
          </Field>
        </section>

        <section className="span2">
          <h4>Solana</h4>
          <Field label="RPC URL:" suffix="">
            {text("solanaRpc", { placeholder: DEFAULT_SETTINGS.solanaRpc, "aria-label": "Solana RPC URL", onBlur: () => solanaSocket.restart() })}
          </Field>
          <Field label="WebSocket URL:" suffix="">
            {text("solanaWs", { placeholder: "derived from RPC URL", "aria-label": "Solana WebSocket URL", onBlur: () => solanaSocket.restart() })}
          </Field>
          <Field label="Jupiter API key:" suffix="">
            {text("jupiterKey", { type: "password", placeholder: "optional — raises price rate limits", "aria-label": "Jupiter API key", autoComplete: "off" })}
          </Field>
          <p className="muted tiny">
            Public endpoints are rate-limited. For the fastest live updates use your own RPC (Helius, Triton, QuickNode…) — its
            WebSocket streams balance changes the moment they confirm. Keys are stored only in this browser.
          </p>
        </section>

        <section className="span2">
          <h4>Data</h4>
          <div className="actionRow">
            <button type="button" onClick={exportData}>
              Export backup
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}>
              Import backup
            </button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files[0] && importData(e.target.files[0])} />
            <button
              type="button"
              className="ghost"
              onClick={() => {
                cacheStore.set({});
                toast("Balance cache cleared");
              }}
            >
              Clear balance cache
            </button>
            <button
              type="button"
              className="ghost danger"
              onClick={() => window.confirm("Delete all portfolio history?") && (historyStore.set([]), toast("History cleared"))}
            >
              Clear history
            </button>
            <button type="button" className="ghost" onClick={() => (resetSettings(), toast("Settings reset"))}>
              Reset settings
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
