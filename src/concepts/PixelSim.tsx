import { useRef, type ReactNode } from "react";
import { useOnScreen, usePrefersReducedMotion } from "../pixel/hooks";
import type { Ctx } from "../pixel/pixel";
import { useEasedScene } from "./useEasedScene";

/**
 * Free-play harness: a dark inset "film frame" whose pixel scene chases
 * the `target` state the widget holds. Controls live in the widget, not
 * here — PixelSim only renders the canvas and the optional two-dial HUD.
 */

export interface SimHud {
  people: -1 | 0 | 1;
  wages: -1 | 0 | 1;
  label: string;
}

function Arrow({ v }: { v: -1 | 0 | 1 }) {
  if (v > 0) return <span className="hud-up">▲</span>;
  if (v < 0) return <span className="hud-dn">▼</span>;
  return <span className="hud-fl">—</span>;
}

export function HudOverlay({ hud }: { hud: SimHud }) {
  return (
    <div className="sim-hud on">
      <div className="hud-chip">
        People <Arrow v={hud.people} />
      </div>
      <div className="hud-chip">
        Paychecks <Arrow v={hud.wages} />
      </div>
      <div className="hud-verdict">{hud.label}</div>
    </div>
  );
}

export function PixelSim<S extends Record<string, number>>({
  w,
  h,
  draw,
  target,
  ariaLabel,
  hud,
  overlay,
  canvasRef,
}: {
  w: number;
  h: number;
  draw: (ctx: Ctx, t: number, s: S) => void;
  target: S;
  ariaLabel: string;
  hud?: SimHud | null;
  /** extra chrome pinned over the frame (e.g. town name tags) */
  overlay?: ReactNode;
  /** exposes the live canvas so a widget can poll a scene's readout */
  canvasRef?: { current: HTMLCanvasElement | null };
}) {
  const innerRef = useRef<HTMLCanvasElement | null>(null);
  const { ref, visible } = useOnScreen<HTMLDivElement>("200px");
  const reduced = usePrefersReducedMotion();
  useEasedScene({ canvasRef: innerRef, draw, target, live: visible && !reduced });

  return (
    <div className="sim-inset pixel" ref={ref}>
      <canvas
        ref={(el) => {
          innerRef.current = el;
          if (canvasRef) canvasRef.current = el;
        }}
        width={w}
        height={h}
        role="img"
        aria-label={ariaLabel}
      />
      {hud && <HudOverlay hud={hud} />}
      {overlay}
    </div>
  );
}
