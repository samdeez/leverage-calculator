// Global keyboard shortcut registry. Components register bindings with
// useHotkeys(); the help overlay reads the same registry so hints never drift
// from the real behaviour.
import { useEffect, useRef, useSyncExternalStore } from "react";

const registry = new Map(); // token -> { group, bindings, handlersRef }
const listeners = new Set();
let snapshot = [];
let seq = 0;

function emit() {
  snapshot = [...registry.values()].flatMap((r) =>
    r.bindings.filter((b) => !b.hidden).map((b) => ({ ...b, group: r.group }))
  );
  listeners.forEach((l) => l());
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");

/** Turn a KeyboardEvent into a combo string like "alt+1", "shift+r", "?". */
export function comboFromEvent(e) {
  let key = (e.key || "").toLowerCase();
  if (e.code?.startsWith("Digit")) key = e.code.slice(5);
  else if (e.altKey && e.code?.startsWith("Key")) key = e.code.slice(3).toLowerCase();
  if (key === " ") key = "space";
  if (key === "esc") key = "escape";
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("mod");
  if (e.altKey) parts.push("alt");
  // Shift is meaningful for letters/digits/named keys, not for symbols like "?".
  if (e.shiftKey && (/^[a-z0-9]$/.test(key) || key.length > 1)) parts.push("shift");
  parts.push(key);
  return parts.join("+");
}

const isTyping = (el) =>
  !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

function onKeyDown(e) {
  if (e.defaultPrevented || e.isComposing) return;
  const combo = comboFromEvent(e);
  const typing = isTyping(e.target);
  // Most recently registered wins (e.g. an open modal overrides the page).
  const entries = [...registry.values()].sort((a, b) => b.order - a.order);
  for (const entry of entries) {
    // A modal swallows every page shortcut it doesn't define itself.
    if (entry.exclusive && !entry.bindings.some((b) => b.keys.includes(combo))) return;
    for (const b of entry.bindings) {
      if (!b.keys.includes(combo)) continue;
      const allowed = !typing || b.allowInInput || combo.startsWith("mod+") || combo.startsWith("alt+") || combo === "escape";
      if (!allowed) continue;
      const handler = entry.handlersRef.current[b.id];
      if (!handler) continue;
      if (handler(e) !== false) e.preventDefault();
      return;
    }
  }
}

let attached = false;
function attach() {
  if (attached || typeof window === "undefined") return;
  window.addEventListener("keydown", onKeyDown);
  attached = true;
}

/**
 * Register shortcuts while mounted.
 * bindings: [{ id, keys: ["p"], label, run, allowInInput?, hidden? }]
 * opts.exclusive: block all lower-priority shortcuts (for modals).
 */
export function useHotkeys(group, bindings, { enabled = true, exclusive = false } = {}) {
  const handlersRef = useRef({});
  handlersRef.current = Object.fromEntries(bindings.map((b) => [b.id, b.run]));
  const signature = bindings.map((b) => `${b.id}:${b.keys.join("|")}:${b.label}:${b.hidden ? 1 : 0}`).join(";");

  useEffect(() => {
    if (!enabled) return undefined;
    attach();
    const token = Symbol(group);
    const meta = bindings.map(({ run, ...rest }) => rest);
    registry.set(token, { group, bindings: meta, handlersRef, exclusive, order: ++seq });
    emit();
    return () => {
      registry.delete(token);
      emit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, signature, enabled, exclusive]);
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useHotkeyList() {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

/** Pretty label for a combo, e.g. "alt+1" → ["Alt", "1"]. */
export function comboParts(combo) {
  return combo.split("+").map((p) => {
    if (p === "mod") return isMac ? "⌘" : "Ctrl";
    if (p === "alt") return isMac ? "⌥" : "Alt";
    if (p === "shift") return "⇧";
    if (p === "escape") return "Esc";
    if (p === "arrowup") return "↑";
    if (p === "arrowdown") return "↓";
    if (p === "enter") return "↵";
    return p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1);
  });
}
