import { useEffect, useRef, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useStory } from './useStory';

// One full-screen step in the story. Registers itself with <StoryScroller> so
// the observer can track it, and fades/rises its content in when it becomes the
// active section. Two layout variants:
//   • 'panel' — transparent background so the shared <StoryMap> shows through;
//               content sits in a translucent card. Used for the map sections.
//   • 'full'  — solid background; standard centered column. Used for charts.
//   • 'stage' — solid background, but the body fills the whole section and the
//               head floats as a card over it. Used for the full-bleed MSA map.

type Variant = 'panel' | 'full' | 'stage';

type Props = {
  index: number;
  eyebrow?: ReactNode;
  title: ReactNode;
  narrative?: ReactNode;
  children?: ReactNode;
  variant?: Variant;
};

export default function Section({
  index,
  eyebrow,
  title,
  narrative,
  children,
  variant = 'full',
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const { register, activeIndex } = useStory();
  const reduce = useReducedMotion();

  useEffect(() => {
    register(index, ref.current);
    return () => register(index, null);
  }, [index, register]);

  const active = activeIndex === index;

  return (
    <section
      ref={ref}
      className={`story-section story-section-${variant}`}
      // Focusable (but not in the tab order) so arrow/rail navigation can move
      // focus here, keeping a screen reader's cursor in sync with the visible
      // section. aria-label gives that focus move a spoken identity.
      tabIndex={-1}
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <motion.div
        className="story-section-inner"
        initial={false}
        animate={
          reduce
            ? { opacity: 1, y: 0 }
            : { opacity: active ? 1 : 0.2, y: active ? 0 : 28 }
        }
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="story-head">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2 className="story-title">{title}</h2>
          {narrative && <div className="story-narrative">{narrative}</div>}
        </div>
        {children && <div className="story-body">{children}</div>}
      </motion.div>
    </section>
  );
}
