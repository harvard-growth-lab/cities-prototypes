import { useRef } from "react";
import { useOnScreen, usePrefersReducedMotion, useScrollyStep } from "../pixel/hooks";
import type { Ctx } from "../pixel/pixel";
import { useEasedScene } from "./useEasedScene";
import { HudOverlay, type SimHud } from "./PixelSim";

/**
 * A contained scrolly: step cards on the left, a sticky inset frame on the
 * right, all inside a normal in-flow section — the story's grammar at
 * widget scale, without the full-bleed takeover. The document scrolls;
 * useScrollyStep's viewport middle band picks the active card.
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
  const { active, stepRef } = useScrollyStep(steps.length);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { ref, visible } = useOnScreen<HTMLDivElement>("200px");
  const reduced = usePrefersReducedMotion();
  useEasedScene({
    canvasRef,
    draw,
    target: steps[active].state,
    live: visible && !reduced,
  });
  const hud = steps[active].hud;

  return (
    <div className="widget-scrolly" ref={ref}>
      <div className="ws-steps">
        {steps.map((st, i) => (
          <div
            key={i}
            ref={stepRef(i)}
            data-step={i}
            className={`ws-step${active === i ? " active" : ""}`}
          >
            {st.title && <h3>{st.title}</h3>}
            {st.body?.map((p) => (
              <p key={p.slice(0, 16)}>{p}</p>
            ))}
          </div>
        ))}
      </div>
      <div className="ws-stage">
        <div className="sim-inset pixel">
          <canvas ref={canvasRef} width={w} height={h} role="img" aria-label={ariaLabel} />
          {hud && <HudOverlay hud={hud} />}
        </div>
      </div>
    </div>
  );
}
