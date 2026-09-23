import { useRef, type ReactNode } from "react";
import { useScrollyStep } from "./hooks";

/**
 * The diagnostic-pathway page's scrolly grammar, in the r2d3 layout: prose
 * cards in a narrow left column, one sticky SVG stage filling the right,
 * the active card driving the stage's scene. Light GL paper, no canvas —
 * the stages are framer-motion SVGs that tween between scene states.
 *
 * On narrow screens the stage pins to the top of the viewport and the
 * cards scroll beneath it (the stage carries its own paper background so
 * passing cards slide under cleanly).
 */

export interface ActStep<S> {
  scene: S;
  eyebrow?: string;
  title?: string;
  body?: string[];
  /** which branch of the tree this step narrates (user-set: the branch
      hand-offs read more distinctly when the cards say whose they are) —
      renders a "The Demand/Supply Branch" marker over the title and a
      side bar in the branch's color along the card's text */
  branch?: "demand" | "supply";
  /** extra content after the body (links, side charts); the function form
      receives whether this step is the active one, so side visuals can
      draw themselves on first activation */
  extra?: ReactNode | ((active: boolean) => ReactNode);
}

export function ScrollyAct<S>({
  steps,
  children,
}: {
  steps: ActStep<S>[];
  /** stage renderer — receives the active step's scene, the active index,
      and `engaged` (true once the reader has scrolled a step card into the
      middle band — stages hold their first-mount draws until then) */
  children: (scene: S, active: number, engaged: boolean) => ReactNode;
}) {
  /* the stage card's own edges feed `engaged`: the first draw sits at the
     card's bottom, and it must not run until that edge is on screen */
  const stageRef = useRef<HTMLDivElement | null>(null);
  const { active, stepRef, engaged } = useScrollyStep(steps.length, stageRef);

  return (
    <section className="tree-act">
      <div className="ta-stage-wrap" aria-hidden="true">
        <div className="ta-stage">
          <div className="ta-stage-card" ref={stageRef}>
            {children(steps[active].scene, active, engaged)}
          </div>
        </div>
      </div>
      <div className="ta-steps">
        {steps.map((st, i) => (
          <div
            key={i}
            ref={stepRef(i)}
            data-step={i}
            className={`ta-step${active === i ? " active" : ""}`}
          >
            <div className={`ta-step-inner${st.branch ? ` ta-branch-${st.branch}` : ""}`}>
              {st.branch && (
                <div className="ta-branch-tag">
                  {st.branch === "demand" ? "The Demand Branch" : "The Supply Branch"}
                </div>
              )}
              {st.eyebrow && <div className="ta-eyebrow">{st.eyebrow}</div>}
              {st.title && <h3>{st.title}</h3>}
              {st.body?.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
              {typeof st.extra === "function" ? st.extra(active === i) : st.extra}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
