import React from "react";
import { NumericFormat } from "react-number-format";
import { autoStep, clamp, decimalsOf, num, toNumStr } from "../lib/math";

/**
 * Numeric input with thousand separators and keyboard stepping.
 *
 * - Value is always a plain numeric string ("1234.5", "-", "").
 * - onChange only fires for user edits. react-number-format also calls
 *   onValueChange when the `value` prop changes; forwarding those caused the
 *   old "jumping" bug where a linked field rewrote the one being typed in.
 * - ↑/↓ step the value (Shift ×10, Alt ×0.1); default step is ~1% of the value.
 * - Enter / Shift+Enter move focus to the next / previous field.
 */
export default function NumberField({
  value,
  onChange,
  step,
  min = -Infinity,
  max = Infinity,
  allowNegative = false,
  decimalScale,
  className = "input",
  emptyBase,
  ...rest
}) {
  const handleKeyDown = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      // An empty field steps from `emptyBase` (e.g. exit price starts at entry).
      const cur = value === "" || value == null ? num(emptyBase) : num(value);
      const base = typeof step === "function" ? step(cur) : step ?? autoStep(cur);
      const s = base * (e.shiftKey ? 10 : e.altKey ? 0.1 : 1);
      const dir = e.key === "ArrowUp" ? 1 : -1;
      const lo = allowNegative ? min : Math.max(0, min);
      const next = clamp(cur + dir * s, lo, max);
      const dp = Math.max(decimalsOf(s), decimalsOf(toNumStr(cur, 10)));
      onChange(toNumStr(next, Math.min(dp, decimalScale ?? 12)));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      // Inside a form, Enter submits it; elsewhere it moves to the next field.
      if (e.currentTarget.form && !e.shiftKey) {
        e.currentTarget.form.requestSubmit();
        return;
      }
      const scope = e.currentTarget.closest("[data-fieldgroup]") || document;
      const inputs = [...scope.querySelectorAll("input:not([disabled]), select:not([disabled])")].filter(
        (el) => el.offsetParent !== null || el === e.currentTarget
      );
      const i = inputs.indexOf(e.currentTarget);
      const next = inputs[i + (e.shiftKey ? -1 : 1)];
      if (next) {
        next.focus();
        next.select?.();
      } else e.currentTarget.blur();
    }
    if (e.key === "Escape") e.currentTarget.blur();
  };

  return (
    <NumericFormat
      value={value ?? ""}
      valueIsNumericString
      thousandSeparator=","
      allowNegative={allowNegative}
      decimalScale={decimalScale}
      inputMode="decimal"
      autoComplete="off"
      className={className}
      onValueChange={(v, src) => {
        if (src.source === "event") onChange(v.value);
      }}
      onKeyDown={handleKeyDown}
      onFocus={(e) => e.target.select()}
      {...rest}
    />
  );
}
