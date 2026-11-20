// Small shared UI building blocks.
import React, { useEffect, useRef } from "react";
import { comboParts, useHotkeys } from "../hooks/useHotkeys";
import { useSettings } from "../lib/settingsStore";

/** Keyboard hint badge. Hidden on touch devices and when hints are off. */
export function Kbd({ combo, className = "" }) {
  const { showHints } = useSettings();
  if (!combo || (!showHints && !className.includes("always"))) return null;
  return (
    <span className={`kbd ${className}`} aria-hidden="true">
      {comboParts(combo).map((p, i) => (
        <kbd key={i}>{p}</kbd>
      ))}
    </span>
  );
}

/** Label / input / suffix row, the app's core form layout. */
export function Field({ label, suffix, hint, children, htmlFor }) {
  return (
    <div className="inputContainer">
      <label className="inputLabel" htmlFor={htmlFor}>
        {label}
        {hint && <span className="inputHint">{hint}</span>}
      </label>
      {children}
      <div className="inputSuffix">{suffix}</div>
    </div>
  );
}

/** Two-or-more option toggle. options: [{ value, label, combo? }] */
export function Segmented({ value, onChange, options, size = "", className = "" }) {
  return (
    <div className={`segmented ${size} ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={`${value === o.value ? "active" : ""} ${o.className || ""}`}
          onClick={() => onChange(o.value)}
          title={o.title}
        >
          {o.label}
          {o.combo && <Kbd combo={o.combo} />}
        </button>
      ))}
    </div>
  );
}

export function Card({ title, actions, children, className = "" }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="cardHead">
          {title && <h3>{title}</h3>}
          {actions && <div className="cardActions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Line in a result card: label on the left, value on the right. */
export function Row({ label, children, className = "", title }) {
  return (
    <div className={`row ${className}`} title={title}>
      <span className="rowLabel">{label}</span>
      <span className="rowValue">{children}</span>
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useHotkeys("Dialog", [{ id: "close", keys: ["escape"], label: "Close dialog", run: onClose }], { exclusive: true });
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.querySelector("input, button, select, textarea")?.focus();
    return () => prev?.focus?.();
  }, []);
  return (
    <div className="modalBackdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="modalHead">
          <h2>{title}</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ✕ <Kbd combo="escape" />
          </button>
        </header>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  );
}

/** Blurs its content in privacy mode. */
export function Private({ children, className = "" }) {
  const { privacy } = useSettings();
  return <span className={`${privacy ? "private" : ""} ${className}`}>{children}</span>;
}

export function StatusDot({ status, label }) {
  const cls = status === "live" ? "live" : status === "polling" ? "poll" : status === "idle" ? "idle" : "wait";
  return (
    <span className={`statusDot ${cls}`} title={`Feed: ${status}`}>
      <i />
      {label ?? status}
    </span>
  );
}
