import { useEffect, useRef, type ReactNode } from "react";
import { useOnScreen, usePrefersReducedMotion, useScrollyStep } from "./hooks";
import type { Ctx } from "./pixel";

/**
 * One act of the feature: a full-viewport sticky pixel scene with story
 * cards scrolling over it. The active card sets a target scene state; the
 * render loop eases the live state toward it every frame, so the city
 * morphs with the scroll while real time keeps it breathing. `hour` eases
 * around the clock (21:00 → 07:00 passes through midnight, not noon).
 */

export interface HudState {
  people: -1 | 0 | 1;
  wages: -1 | 0 | 1;
  label: string;
}

export interface ActStep<S> {
  state: S;
  kind?: "title" | "card" | "breather";
  align?: "left" | "center" | "right";
  eyebrow?: string;
  title?: string;
  body?: string[];
  hud?: HudState;
  render?: ReactNode; // fully custom card (the page hero)
}

const EASE_RATE = 2.6; // 1/s — how fast the scene chases the active step

function Arrow({ v }: { v: -1 | 0 | 1 }) {
  if (v > 0) return <span className="hud-up">▲</span>;
  if (v < 0) return <span className="hud-dn">▼</span>;
  return <span className="hud-fl">—</span>;
}

export function StoryAct<S extends Record<string, number>>({
  w,
  h,
  draw,
  steps,
  ariaLabel,
}: {
  w: number;
  h: number;
  draw: (ctx: Ctx, t: number, s: S) => void;
  steps: ActStep<S>[];
  ariaLabel: string;
}) {
  const { active, stepRef } = useScrollyStep(steps.length);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { ref: actRef, visible } = useOnScreen<HTMLElement>("300px");
  const reduced = usePrefersReducedMotion();
  const cur = useRef<Record<string, number>>({ ...steps[0].state });
  const tRef = useRef(2.4);
  const activeRef = useRef(0);
  activeRef.current = active;
  const live = visible && !reduced;

  // static path: reduced motion, or a first paint before scrolling in
  useEffect(() => {
    if (live) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    Object.assign(cur.current, steps[active].state);
    draw(ctx, tRef.current, cur.current as S);
  }, [active, live, draw, steps]);

  useEffect(() => {
    if (!live) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      if (acc < 1 / 30) return;
      const dt = acc;
      acc = 0;
      tRef.current += dt;
      const tgt = steps[activeRef.current].state;
      const k = 1 - Math.exp(-dt * EASE_RATE);
      const c = cur.current;
      for (const key in tgt) {
        if (key === "hour") {
          const d = ((tgt.hour - c.hour + 36) % 24) - 12;
          c.hour = (c.hour + d * k + 24) % 24;
        } else {
          c[key] += (tgt[key] - c[key]) * k;
        }
      }
      draw(ctx, tRef.current, c as S);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [live, draw, steps]);

  // keep the last HUD content mounted so it can fade out gracefully
  const hud = steps[active].hud;
  const lastHud = useRef<HudState | undefined>(undefined);
  if (hud) lastHud.current = hud;
  const shown = hud ?? lastHud.current;

  return (
    <section className="story-act" ref={actRef}>
      <div className="story-stage">
        <canvas ref={canvasRef} width={w} height={h} role="img" aria-label={ariaLabel} />
        <div className={`story-hud${hud ? " on" : ""}`} aria-hidden={!hud}>
          {shown && (
            <>
              <div className="hud-chip">
                People <Arrow v={shown.people} />
              </div>
              <div className="hud-chip">
                Paychecks <Arrow v={shown.wages} />
              </div>
              <div className="hud-verdict">{shown.label}</div>
            </>
          )}
        </div>
      </div>
      <div className="story-steps">
        {steps.map((st, i) => (
          <div
            key={i}
            ref={stepRef(i)}
            data-step={i}
            className={`story-step ${st.kind ?? "card"} ${st.align ?? "center"}${
              active === i ? " active" : ""
            }`}
          >
            {st.render ??
              (st.kind === "title" ? (
                // chapter titles: content wrapped so the underlay hugs the
                // text while the step itself centers it in the viewport
                <div className="story-titlecard">
                  {st.eyebrow && <div className="eyebrow">{st.eyebrow}</div>}
                  {st.title && <h3>{st.title}</h3>}
                </div>
              ) : (
                <>
                  {st.eyebrow && <div className="eyebrow">{st.eyebrow}</div>}
                  {st.title && <h3>{st.title}</h3>}
                  {st.body?.map((p) => (
                    <p key={p.slice(0, 18)}>{p}</p>
                  ))}
                </>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
