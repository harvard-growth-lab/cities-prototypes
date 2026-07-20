import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StoryContext } from './useStory';

// Full-screen scroll-snapped story container. Owns the active-section index via
// a single IntersectionObserver rooted on the scroll element; <Section>s
// register their DOM nodes through context. Renders the nav chrome (prev/next
// arrows + a progress rail) and an optional `chrome` slot pinned in the corner
// (the year-range selector lives there, since every section's numbers key off
// the global compare window).

export default function StoryScroller({
  children,
  chrome,
  resetKey,
}: {
  children: ReactNode;
  chrome?: ReactNode;
  // When this changes (e.g. the user picks a different place), jump back to the
  // start of the story rather than holding the previous scroll position.
  resetKey?: string | number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const elsRef = useRef<Map<number, HTMLElement>>(new Map());
  const ratiosRef = useRef<Map<number, number>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [count, setCount] = useState(0);

  // Keep imperative nav reading the latest values without re-creating callbacks.
  const activeRef = useRef(0);
  activeRef.current = activeIndex;
  const countRef = useRef(0);
  countRef.current = count;

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.storyIndex);
          ratiosRef.current.set(idx, e.isIntersecting ? e.intersectionRatio : 0);
        }
        let best = 0;
        let bestRatio = -1;
        for (const [idx, r] of ratiosRef.current) {
          if (r > bestRatio) {
            bestRatio = r;
            best = idx;
          }
        }
        setActiveIndex(best);
      },
      { root, threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] },
    );
    observerRef.current = obs;
    for (const el of elsRef.current.values()) obs.observe(el);
    return () => {
      obs.disconnect();
      observerRef.current = null;
    };
  }, []);

  // Snap to the top of the story when the subject changes. The observer will
  // re-derive the active index from the new scroll position, but set it to 0
  // eagerly so the rail/arrows update without waiting for a frame.
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    setActiveIndex(0);
  }, [resetKey]);

  const register = useCallback((index: number, el: HTMLElement | null) => {
    const map = elsRef.current;
    const prev = map.get(index);
    if (prev && prev !== el) observerRef.current?.unobserve(prev);
    if (el) {
      el.dataset.storyIndex = String(index);
      map.set(index, el);
      observerRef.current?.observe(el);
    } else {
      map.delete(index);
      ratiosRef.current.delete(index);
    }
    setCount(map.size);
  }, []);

  const goTo = useCallback((index: number) => {
    const max = countRef.current - 1;
    const clamped = Math.max(0, Math.min(index, max));
    const el = elsRef.current.get(clamped);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth' });
    // Move focus to the section so keyboard + screen-reader users land on the
    // content they navigated to (preventScroll: the scrollIntoView owns motion).
    el.focus({ preventScroll: true });
  }, []);
  const next = useCallback(() => goTo(activeRef.current + 1), [goTo]);
  const prev = useCallback(() => goTo(activeRef.current - 1), [goTo]);

  // Keyboard paging — but only when focus isn't in a form control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const atStart = activeIndex <= 0;
  const atEnd = count > 0 && activeIndex >= count - 1;

  return (
    <StoryContext.Provider value={{ activeIndex, count, register, goTo, next, prev }}>
      <div className="story-scroller" ref={containerRef}>
        {children}

        {chrome && <div className="story-chrome">{chrome}</div>}

        {/* Progress rail — one dot per registered section. */}
        <nav className="story-rail" aria-label="Section navigation">
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`story-rail-dot${i === activeIndex ? ' is-active' : ''}`}
              aria-label={`Go to section ${i + 1}`}
              aria-current={i === activeIndex}
              onClick={() => goTo(i)}
            />
          ))}
        </nav>

        {/* Prev / next arrows. */}
        <div className="story-arrows">
          <button
            type="button"
            className="story-arrow"
            aria-label="Previous section"
            disabled={atStart}
            onClick={prev}
          >
            ↑
          </button>
          <button
            type="button"
            className="story-arrow"
            aria-label="Next section"
            disabled={atEnd}
            onClick={next}
          >
            ↓
          </button>
        </div>
      </div>
    </StoryContext.Provider>
  );
}
