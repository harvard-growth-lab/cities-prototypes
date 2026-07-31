import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Scroll driver for the sticky-stage variants: the ref'd element is a tall
 * runway with a sticky stage inside; every scroll/resize frame the callback
 * receives the runway's progress 0…1 (how far the stage has travelled
 * through it). Imperative on purpose — callers write transforms straight to
 * refs at scroll rate and lift only discrete step changes into React state.
 */
export function useScrollDrive<T extends HTMLElement>(
  onFrame: (p: number) => void,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const cb = useRef(onFrame);
  cb.current = onFrame;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? -r.top / span : r.top <= 0 ? 1 : 0;
      cb.current(Math.max(0, Math.min(1, p)));
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    queue();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return ref;
}

/** Put the window where the runway's progress reads `p` (0…1). */
export function scrollToProgress(el: HTMLElement, p: number, smooth: boolean) {
  const r = el.getBoundingClientRect();
  const span = Math.max(0, r.height - window.innerHeight);
  window.scrollTo({
    top: window.scrollY + r.top + p * span,
    behavior: smooth ? "smooth" : "auto",
  });
}
