import { useRef, useState } from "react";
import { useOnScreen, usePrefersReducedMotion } from "../pixel/hooks";
import type { Ctx } from "../pixel/pixel";
import { useEasedScene } from "./useEasedScene";
import { HudOverlay, type SimHud } from "./PixelSim";

/**
 * A stepped explainer: one graphic, with each step's text laid over it and
 * Back / Next buttons (plus dots) to move through the steps — no scrolling
 * underneath the frame. The scene eases between step states as you advance.
 */

export interface MiniStep<S> {
  state: S;
  title?: string;
  body?: string[];
  hud?: SimHud;
}

export function MiniScrolly<S extends Record<string, number>>({
  w,
  h,
  draw,
  steps,
  ariaLabel,
}: {
  w: number;
  h: number;
  draw: (ctx: Ctx, t: number, s: S) => void;
  steps: MiniStep<S>[];
  ariaLabel: string;
}) {
  const [active, setActive] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { ref, visible } = useOnScreen<HTMLDivElement>("200px");
  const reduced = usePrefersReducedMotion();
  useEasedScene({
    canvasRef,
    draw,
    target: steps[active].state,
    live: visible && !reduced,
  });
  const step = steps[active];
  const hud = step.hud;
  const atStart = active === 0;
  const atEnd = active === steps.length - 1;

  return (
    <div className="widget-stepper" ref={ref}>
      <div className="sim-inset pixel wstep-stage">
        <canvas ref={canvasRef} width={w} height={h} role="img" aria-label={ariaLabel} />
        {hud && <HudOverlay hud={hud} />}
        {/* aria-live so the step text is announced as the user advances */}
        <div className="wstep-caption" aria-live="polite">
          {step.title && <h3>{step.title}</h3>}
          {step.body?.map((p) => (
            <p key={p.slice(0, 16)}>{p}</p>
          ))}
        </div>
      </div>

      <div className="wstep-nav">
        <button
          className="btn"
          onClick={() => setActive((a) => Math.max(0, a - 1))}
          disabled={atStart}
        >
          ← Back
        </button>
        <div className="wstep-dots" role="tablist" aria-label="Steps">
          {steps.map((st, i) => (
            <button
              key={i}
              role="tab"
              className={`wstep-dot${i === active ? " active" : ""}`}
              aria-selected={i === active}
              aria-label={st.title ? `Step ${i + 1}: ${st.title}` : `Step ${i + 1}`}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
        <button
          className="btn"
          onClick={() => setActive((a) => Math.min(steps.length - 1, a + 1))}
          disabled={atEnd}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
