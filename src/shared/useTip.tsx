/** Tiny shared hover-tooltip: fixed-position card following the cursor. */

import { useState, type ReactNode } from "react";

export interface TipState {
  x: number;
  y: number;
  title: string;
  sub?: ReactNode;
}

export function useTip() {
  const [tip, setTip] = useState<TipState | null>(null);

  const show = (e: { clientX: number; clientY: number }, title: string, sub?: ReactNode) =>
    setTip({ x: e.clientX, y: e.clientY, title, sub });
  const hide = () => setTip(null);

  const tipEl = tip ? (
    <div
      className="tooltip"
      style={{
        left: Math.min(tip.x + 14, window.innerWidth - 300),
        top: Math.min(tip.y + 16, window.innerHeight - 120),
      }}
    >
      <div className="t-title">{tip.title}</div>
      {tip.sub && <div className="t-sub">{tip.sub}</div>}
    </div>
  ) : null;

  return { show, hide, tipEl };
}
