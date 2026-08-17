import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Scrollytelling step tracker: observes step elements and reports which one
 * is currently in the middle band of the viewport. (Ported from the
 * cities-explainer prototype; the scroll listener uses capture because here
 * the scrolling happens inside the .explainers-view container, whose scroll
 * events never bubble to window.)
 */
export function useScrollyStep(count: number, stageRef?: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(0);
  /** true while the reader is LOOKING AT the arrived scrolly — the first
      step card has reached the viewport's middle band AND the sticky
      stage's bottom edge has risen to the fold (user-set, both live, not
      latched): stages key their first draw — the x axis, which lives at
      the BOTTOM of the stage — off it, and that draw must run where it
      can be seen and retract when the reader scrolls back up. The card
      condition alone fired ~half a viewport early: the stage is a
      100vh-tall sticky box still mostly below the fold at that moment,
      so the axis stroked itself on off-screen and every arrival met a
      finished static line. Measured on scroll/resize (rAF-throttled) —
      IntersectionObserver's card crossings are too coarse to track the
      stage edge. */
  const [engaged, setEngaged] = useState(false);
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

  useEffect(() => {
    const measure = () => {
      const first = refs.current[0];
      if (!first) return;
      const vh = window.innerHeight;
      const cardReached = first.getBoundingClientRect().top < vh * 0.55;
      const stage = stageRef?.current;
      /* the stage's bottom (where the axis draws) at the fold — with a
         pinned-at-top fallback for viewports shorter than the stage */
      const stageSeen = !stage
        ? true
        : (() => {
            const r = stage.getBoundingClientRect();
            return r.bottom <= vh + 24 || r.top <= vh * 0.15;
          })();
      setEngaged(cardReached && stageSeen);
    };
    let raf = 0;
    const onScroll = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          measure();
        });
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
    };
  }, [stageRef]);

  const stepRef = (i: number) => (el: HTMLElement | null) => {
    refs.current[i] = el;
  };

  return { active, stepRef, engaged };
}
