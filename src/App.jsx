import React, { useCallback, useState } from "react";
import LiveTicker from "./components/LiveTicker";
import SettingsModal from "./components/SettingsModal";
import ShortcutHelp from "./components/ShortcutHelp";
import { Kbd } from "./components/ui";
import { PortfolioProvider } from "./context/Portfolio";
import { ToastProvider, useToast } from "./context/Toast";
import TradeCalculator from "./features/calculator/TradeCalculator";
import Portfolio from "./features/portfolio/Portfolio";
import Tools, { AlertWatcher } from "./features/tools/Tools";
import { useHotkeys } from "./hooks/useHotkeys";
import { usePersistentState } from "./hooks/usePersistentState";
import { toNumStr } from "./lib/math";
import { setSettings, useSettings } from "./lib/settingsStore";

const TABS = [
  { id: "spot", label: "Spot" },
  { id: "leverage", label: "Leverage" },
  { id: "portfolio", label: "Portfolio" },
  { id: "tools", label: "Tools" },
];

function Shell() {
  const initialTab = () => {
    const m = /^#(spot|leverage)\?/.exec(window.location.hash);
    return m ? m[1] : undefined;
  };
  const [tab, setTab] = usePersistentState("levcal:tab.v1", () => initialTab() || "spot");
  const [visited, setVisited] = useState(() => new Set([tab]));
  const [modal, setModal] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const settings = useSettings();
  const toast = useToast();

  const go = useCallback(
    (id) => {
      setTab(id);
      setVisited((v) => (v.has(id) ? v : new Set(v).add(id)));
    },
    [setTab]
  );

  const sendToCalc = (mode, patch) => {
    go(mode);
    setIncoming({ mode, patch, nonce: Date.now() });
  };

  useHotkeys("Global", [
    ...TABS.map((t, i) => ({
      id: `tab${i}`,
      keys: [String(i + 1), `alt+${i + 1}`],
      label: `Go to ${t.label}`,
      run: () => go(t.id),
    })),
    { id: "help", keys: ["?"], label: "Show shortcuts", run: () => setModal("help") },
    { id: "settings", keys: [","], label: "Settings", run: () => setModal("settings") },
    {
      id: "privacy",
      keys: ["h"],
      label: "Hide / show balances",
      run: () => {
        setSettings((s) => ({ privacy: !s.privacy }));
        toast(settings.privacy ? "Balances visible" : "Privacy mode on");
      },
    },
    { id: "hints", keys: ["shift+k"], label: "Toggle hint badges", run: () => setSettings((s) => ({ showHints: !s.showHints })) },
    {
      id: "blur",
      keys: ["escape"],
      label: "Leave input",
      hidden: true,
      run: () => {
        if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
        else return false;
      },
    },
  ]);

  return (
    <div className="container-wrapper">
      <header className="appHeader">
        <h1>$ Leverage Calculator $</h1>
        <div className="headerActions">
          <button type="button" className={`ghost ${settings.privacy ? "on" : ""}`} title="Privacy mode" onClick={() => setSettings((s) => ({ privacy: !s.privacy }))}>
            {settings.privacy ? "◌" : "◉"} <Kbd combo="h" />
          </button>
          <button type="button" className="ghost" title="Keyboard shortcuts" onClick={() => setModal("help")}>
            ? <Kbd combo="?" />
          </button>
          <button type="button" className="ghost" title="Settings" onClick={() => setModal("settings")}>
            ⚙ <Kbd combo="," />
          </button>
        </div>
      </header>

      <nav className="button-wrapper" role="tablist">
        {TABS.map((t, i) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => go(t.id)}>
            {t.label}
            <Kbd combo={String(i + 1)} />
          </button>
        ))}
      </nav>

      <LiveTicker
        onPick={(asset, price) => {
          const mode = tab === "leverage" ? "leverage" : "spot";
          sendToCalc(mode, { asset, ...(price ? { entry: toNumStr(price, 8) } : {}) });
        }}
      />

      <main>
        {TABS.map((t) =>
          visited.has(t.id) || t.id === tab ? (
            <div key={t.id} role="tabpanel" hidden={tab !== t.id}>
              {(t.id === "spot" || t.id === "leverage") && <TradeCalculator mode={t.id} active={tab === t.id} incoming={incoming} />}
              {t.id === "portfolio" && <Portfolio active={tab === t.id} openInCalculator={(patch) => sendToCalc("spot", patch)} />}
              {t.id === "tools" && <Tools active={tab === t.id} loadScenario={(mode, state) => sendToCalc(mode, state)} />}
            </div>
          ) : null
        )}
      </main>

      <footer className="appFooter muted tiny">
        Press <Kbd combo="?" className="always" /> for shortcuts · data stays in your browser
      </footer>

      {modal === "help" && <ShortcutHelp onClose={() => setModal(null)} />}
      {modal === "settings" && <SettingsModal onClose={() => setModal(null)} />}
      <AlertWatcher />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <PortfolioProvider>
        <Shell />
      </PortfolioProvider>
    </ToastProvider>
  );
}
