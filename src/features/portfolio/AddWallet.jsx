import React, { useState } from "react";
import { Kbd } from "../../components/ui";
import { useToast } from "../../context/Toast";
import { usePortfolio } from "../../context/Portfolio";
import { CHAIN_FAMILIES, detectChain, resolveAddress } from "../../lib/chains";
import { EVM_CHAINS } from "../../lib/chains/evm";

export default function AddWallet({ inputRef, onDone }) {
  const { addWallet, wallets } = usePortfolio();
  const toast = useToast();
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [override, setOverride] = useState("");
  const [chains, setChains] = useState(EVM_CHAINS.map((c) => c.key));
  const [busy, setBusy] = useState(false);
  const detected = detectChain(address);
  const family = override || detected;

  const submit = async (e) => {
    e.preventDefault();
    if (!family) return toast("Unrecognized address format", "warn");
    setBusy(true);
    try {
      const resolved = await resolveAddress(address, family);
      if (wallets.some((w) => w.address === resolved && w.family === family)) {
        toast("Wallet already tracked", "warn");
        return;
      }
      addWallet({
        family,
        address: resolved,
        label: label.trim() || (address.endsWith(".sol") ? address : `${CHAIN_FAMILIES[family].label} ${wallets.length + 1}`),
        ...(family === "evm" ? { chains } : {}),
      });
      toast("Wallet added — syncing…", "ok");
      setAddress("");
      setLabel("");
      setOverride("");
      onDone?.();
    } catch (err) {
      toast(err.message || "Could not add wallet", "warn");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="addWallet" onSubmit={submit} data-fieldgroup>
      <div className="addRow">
        <input
          ref={inputRef}
          className="input wide"
          placeholder="Solana / EVM / BTC address or name.sol"
          value={address}
          onChange={(e) => setAddress(e.target.value.trim())}
          aria-label="Wallet address"
          spellCheck={false}
        />
        <span className={`chainBadge ${family || "none"}`}>{family ? CHAIN_FAMILIES[family].short : "?"}</span>
      </div>
      <div className="addRow">
        <input className="input" placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Wallet label" maxLength={32} />
        <select className="input" value={override} onChange={(e) => setOverride(e.target.value)} aria-label="Chain">
          <option value="">Auto-detect</option>
          {Object.entries(CHAIN_FAMILIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <button type="submit" className="primary" disabled={!address || busy}>
          {busy ? "Adding…" : "Add wallet"} <Kbd combo="enter" />
        </button>
      </div>
      {family === "evm" && (
        <div className="chainPicks">
          {EVM_CHAINS.map((c) => (
            <label key={c.key} className={chains.includes(c.key) ? "on" : ""}>
              <input
                type="checkbox"
                checked={chains.includes(c.key)}
                onChange={(e) => setChains((cur) => (e.target.checked ? [...cur, c.key] : cur.filter((k) => k !== c.key)))}
              />
              {c.name}
            </label>
          ))}
        </div>
      )}
      <p className="muted tiny">
        Read-only: only public addresses are used, nothing is signed. Wallets, balances and history stay in this browser
        (IndexedDB).
      </p>
    </form>
  );
}
