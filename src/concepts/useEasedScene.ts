import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { Ctx } from "../pixel/pixel";

/**
 * The story engine's easing loop, repackaged for control-driven widgets:
 * the live scene chases whatever `target` the caller holds (a preset
 * button, a scroll step) while real time keeps the pixels breathing.
 * Mirrors StoryAct's loop — including the hour easing that wraps around
 * the clock (21:00 → 07:00 passes through midnight, not noon).
 */

const EASE_RATE = 2.6; // 1/s — how fast the scene chases the target

export function useEasedScene<S extends Record<string, number>>({
  canvasRef,
  draw,
  target,
  live,
  easeRate = EASE_RATE,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  draw: (ctx: Ctx, t: number, s: S) => void;
  target: S;
  live: boolean;
  easeRate?: number;
}): void {
  const cur = useRef<Record<string, number> | null>(null);
  if (cur.current === null) cur.current = { ...target };
  const tRef = useRef(2.4);
  // the RAF loop reads the latest target through a ref, so preset clicks
  // never tear the loop down
  const targetRef = useRef(target);
  targetRef.current = target;

  // static path: reduced motion, or a first paint before scrolling in
  useEffect(() => {
    if (live) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    Object.assign(cur.current!, target);
    draw(ctx, tRef.current, cur.current as S);
  }, [live, target, draw, canvasRef]);

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
      const tgt = targetRef.current;
      const k = 1 - Math.exp(-dt * easeRate);
      const c = cur.current!;
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
  }, [live, draw, easeRate, canvasRef]);
}
