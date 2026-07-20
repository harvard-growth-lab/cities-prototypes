import { createContext, useContext } from 'react';

// Shared state for the scroll-snapped story. <StoryScroller> owns the active
// section index (driven by an IntersectionObserver) and exposes imperative
// navigation; <Section> registers its DOM node so the observer can track it,
// and any descendant can read activeIndex to drive section-local animation
// (e.g. the shared map's zoom level keys off this).

export type StoryContextValue = {
  activeIndex: number;
  count: number;
  register: (index: number, el: HTMLElement | null) => void;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
};

export const StoryContext = createContext<StoryContextValue | null>(null);

export function useStory(): StoryContextValue {
  const ctx = useContext(StoryContext);
  if (!ctx) throw new Error('useStory must be used inside <StoryScroller>');
  return ctx;
}
