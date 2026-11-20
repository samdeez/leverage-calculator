import React, { useState } from "react";

// Categorical slots (dark-mode steps), assigned in fixed order; the tail folds into "Other".
export const CATEGORICAL = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9"];
export const OTHER = "#6b6b6b";

/** Fold items beyond the palette into a single "Other" slice. */
export function toSlices(items, max = CATEGORICAL.length) {
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, max).map((s, i) => ({ ...s, color: CATEGORICAL[i] }));
  const tail = sorted.slice(max);
  if (tail.length) head.push({ key: "other", label: `Other (${tail.length})`, value: tail.reduce((s, x) => s + x.value, 0), color: OTHER });
  return head;
}

/** Interactive donut + legend. Hover a slice or legend row to focus it. */
export default function Donut({ items, size = 150, format = (v) => v, centerLabel, onSelect }) {
  const [active, setActive] = useState(null);
  const total = items.reduce((s, i) => s + i.value, 0);
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const gap = items.length > 1 ? 2 : 0;
  let offset = 0;
  const focus = items.find((i) => i.key === active);

  return (
    <div className="donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Allocation">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} className="donutTrack" />
          {total > 0 &&
            items.map((it) => {
              const len = (it.value / total) * c;
              const dash = Math.max(0, len - gap);
              const el = (
                <circle
                  key={it.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={it.color}
                  strokeWidth={active === it.key ? 16 : 12}
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                  opacity={active && active !== it.key ? 0.35 : 1}
                  onPointerEnter={() => setActive(it.key)}
                  onPointerLeave={() => setActive(null)}
                  onClick={() => onSelect?.(it)}
                  style={{ cursor: onSelect ? "pointer" : "default", transition: "stroke-width .15s, opacity .15s" }}
                >
                  <title>{`${it.label}: ${format(it.value)} (${((it.value / total) * 100).toFixed(1)}%)`}</title>
                </circle>
              );
              offset += len;
              return el;
            })}
        </g>
        <text x="50%" y="47%" textAnchor="middle" className="donutValue">
          {focus ? `${((focus.value / total) * 100).toFixed(1)}%` : centerLabel}
        </text>
        <text x="50%" y="60%" textAnchor="middle" className="donutSub">
          {focus ? focus.label : `${items.length} assets`}
        </text>
      </svg>
      <ul className="legend">
        {items.map((it) => (
          <li
            key={it.key}
            className={active === it.key ? "active" : ""}
            onPointerEnter={() => setActive(it.key)}
            onPointerLeave={() => setActive(null)}
            onClick={() => onSelect?.(it)}
          >
            <i style={{ background: it.color }} />
            <span className="legendLabel">{it.label}</span>
            <span className="legendValue">{total ? ((it.value / total) * 100).toFixed(1) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
