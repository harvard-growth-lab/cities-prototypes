import { useEffect, useRef, useState } from "react";

/**
 * The pixel scenes' React glue, ported from the cities-explainer prototype
 * (its pixel lab's hooks). Only what "How to Read a City" needs: which step
 * card is in the middle band, whether an act is on screen at all, the
 * reduced-motion preference, and the seeded RNG the skylines are generated
 * from. All three observers watch the VIEWPORT, not a scroll root, so they
 * work unchanged inside the .explainers-view scroll container.
 */

/** Scrollytelling step tracker: which step element is in the middle band. */
export function useScrollyStep(count: number) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(Number((entry.target as HTMLElement).dataset.step));
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.slice(0, count).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [count]);

  const stepRef = (i: number) => (el: HTMLElement | null) => {
    refs.current[i] = el;
  };

  return { active, stepRef };
}

/** True once the element has entered the viewport (for lazy-starting canvases). */
export function useOnScreen<T extends HTMLElement>(margin = "200px") {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: margin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [margin]);
  return { ref, visible };
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Mulberry32 — deterministic pseudo-random for stable generated skylines. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
