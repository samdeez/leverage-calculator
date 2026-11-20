import React, { useId, useMemo, useRef, useState } from "react";
import { useWidth } from "../../hooks/useSize";

const PAD = { top: 14, right: 12, bottom: 24, left: 56 };

function niceTicks(min, max, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const out = [];
  const start = Math.ceil(min / step);
  for (let i = start; i * step <= max + step * 1e-9 && out.length < 20; i++) out.push(+(i * step).toPrecision(15));
  return [...new Set(out)];
}

/**
 * Responsive SVG line/area chart with a crosshair tooltip.
 * - `baseline`: y value splitting the line into positive/negative colours
 * - `markers`: vertical reference lines [{ x, label, tone }]
 * - `onPick(x)`: click/drag on the plot reports the x under the pointer
 *   (at most once per animation frame); `onPickStart` / `onPickEnd` bracket a drag
 * - `minSpanFrac`: minimum y-range as a fraction of the values, so tiny
 *   fluctuations aren't stretched across the whole chart
 */
export default function LineChart({
  data,
  height = 200,
  formatX = (x) => x,
  formatY = (y) => y,
  tooltip,
  baseline = null,
  markers = [],
  onPick,
  onPickStart,
  onPickEnd,
  minSpanFrac = 0,
  color = "var(--accent)",
  ariaLabel = "chart",
  emptyText = "No data yet",
  xDomain,
}) {
  const [wrapRef, width] = useWidth();
  const [hover, setHover] = useState(null);
  const dragging = useRef(false);
  const pickFrame = useRef(null);
  const pendingPick = useRef(null);
  const uid = useId().replace(/:/g, "");

  const geom = useMemo(() => {
    if (!data?.length) return null;
    const xs = data.map((d) => d.x);
    const ys = data.map((d) => d.y);
    let x0 = xDomain?.[0] ?? Math.min(...xs);
    let x1 = xDomain?.[1] ?? Math.max(...xs);
    if (x0 === x1) x1 = x0 + 1;
    let y0 = Math.min(...ys, baseline ?? Infinity);
    let y1 = Math.max(...ys, baseline ?? -Infinity);
    if (y0 === y1) {
      y0 -= Math.abs(y0) * 0.05 || 1;
      y1 += Math.abs(y1) * 0.05 || 1;
    }
    const minSpan = Math.max(Math.abs(y0), Math.abs(y1)) * minSpanFrac;
    if (y1 - y0 < minSpan) {
      const mid = (y0 + y1) / 2;
      y0 = mid - minSpan / 2;
      y1 = mid + minSpan / 2;
    }
    const padY = (y1 - y0) * 0.08;
    y0 -= padY;
    y1 += padY;
    const iw = Math.max(10, width - PAD.left - PAD.right);
    const ih = height - PAD.top - PAD.bottom;
    const sx = (x) => PAD.left + ((x - x0) / (x1 - x0)) * iw;
    const sy = (y) => PAD.top + (1 - (y - y0) / (y1 - y0)) * ih;
    const invX = (px) => x0 + ((px - PAD.left) / iw) * (x1 - x0);
    const line = data.map((d, i) => `${i ? "L" : "M"}${sx(d.x).toFixed(1)},${sy(d.y).toFixed(1)}`).join("");
    const baseY = sy(baseline ?? y0);
    const area = `${line}L${sx(data[data.length - 1].x).toFixed(1)},${baseY}L${sx(data[0].x).toFixed(1)},${baseY}Z`;
    return { sx, sy, invX, line, area, baseY, iw, ih, x0, x1, yTicks: niceTicks(y0 + padY, y1 - padY), xTicks: niceTicks(x0, x1, Math.max(2, Math.floor(iw / 90))) };
  }, [data, width, height, baseline, xDomain, minSpanFrac]);

  if (!geom) {
    return (
      <div ref={wrapRef} className="chartEmpty" style={{ height }}>
        {emptyText}
      </div>
    );
  }

  const nearest = (px) => {
    const x = geom.invX(px);
    let best = data[0];
    for (const d of data) if (Math.abs(d.x - x) < Math.abs(best.x - x)) best = d;
    return { x, point: best };
  };

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = Math.min(Math.max(e.clientX - rect.left, PAD.left), PAD.left + geom.iw);
    const n = nearest(px);
    setHover(n.point);
    if (dragging.current && onPick) {
      // Coalesce pointer events: one state update per frame keeps drags smooth.
      pendingPick.current = n.x;
      if (!pickFrame.current) {
        pickFrame.current = requestAnimationFrame(() => {
          pickFrame.current = null;
          if (pendingPick.current != null) onPick(pendingPick.current);
        });
      }
    }
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onPickEnd?.();
  };

  const hx = hover ? geom.sx(hover.x) : null;
  const hy = hover ? geom.sy(hover.y) : null;
  const posColor = baseline != null ? "var(--pos)" : color;

  return (
    <div ref={wrapRef} className="chartWrap">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        className={onPick ? "pickable" : ""}
        onPointerMove={handleMove}
        onPointerLeave={() => {
          setHover(null);
          endDrag();
        }}
        onPointerDown={(e) => {
          if (!onPick) return;
          e.preventDefault();
          onPickStart?.();
          dragging.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          handleMove(e);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <defs>
          <linearGradient id={`g${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={posColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={posColor} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`n${uid}`} x1="0" x2="0" y1="1" y2="0">
            <stop offset="0%" stopColor="var(--neg)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--neg)" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`a${uid}`}>
            <rect x="0" y="0" width={width} height={geom.baseY} />
          </clipPath>
          <clipPath id={`b${uid}`}>
            <rect x="0" y={geom.baseY} width={width} height={Math.max(0, height - geom.baseY)} />
          </clipPath>
        </defs>

        {geom.yTicks.map((t) => (
          <g key={`y${t}`}>
            <line className="grid" x1={PAD.left} x2={PAD.left + geom.iw} y1={geom.sy(t)} y2={geom.sy(t)} />
            <text className="axis" x={PAD.left - 6} y={geom.sy(t) + 3} textAnchor="end">
              {formatY(t, true)}
            </text>
          </g>
        ))}
        {geom.xTicks.map((t) => (
          <text key={`x${t}`} className="axis" x={geom.sx(t)} y={height - 6} textAnchor="middle">
            {formatX(t, true)}
          </text>
        ))}

        {baseline != null ? (
          <>
            <path d={geom.area} fill={`url(#g${uid})`} clipPath={`url(#a${uid})`} />
            <path d={geom.area} fill={`url(#n${uid})`} clipPath={`url(#b${uid})`} />
            <path d={geom.line} className="series" stroke="var(--pos)" clipPath={`url(#a${uid})`} />
            <path d={geom.line} className="series" stroke="var(--neg)" clipPath={`url(#b${uid})`} />
            <line className="zero" x1={PAD.left} x2={PAD.left + geom.iw} y1={geom.baseY} y2={geom.baseY} />
          </>
        ) : (
          <>
            <path d={geom.area} fill={`url(#g${uid})`} />
            <path d={geom.line} className="series" stroke={color} />
          </>
        )}

        {markers
          .filter((m) => m.x >= geom.x0 && m.x <= geom.x1)
          .map((m, i) => (
            <g key={`${m.label}${i}`} className={`marker ${m.tone || ""}`}>
              <line x1={geom.sx(m.x)} x2={geom.sx(m.x)} y1={PAD.top} y2={PAD.top + geom.ih} />
              <text x={geom.sx(m.x) + 3} y={PAD.top + 9 + (i % 3) * 11}>
                {m.label}
              </text>
            </g>
          ))}

        {hover && (
          <g className="crosshair">
            <line x1={hx} x2={hx} y1={PAD.top} y2={PAD.top + geom.ih} />
            <circle cx={hx} cy={hy} r="4" />
          </g>
        )}
      </svg>
      {hover && (
        <div
          className="tooltip"
          style={{
            left: Math.min(Math.max(hx, 70), width - 70),
            top: Math.max(0, hy - 46),
          }}
        >
          {tooltip ? tooltip(hover) : (
            <>
              <b>{formatY(hover.y)}</b>
              <span>{formatX(hover.x)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
