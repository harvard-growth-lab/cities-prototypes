import { SECTION_DEFS, branchSectionName } from "../data/content";

interface RailProps {
  currentPageId: string | null;
  onGoTo: (pageId: string) => void;
  /** which side of the diagnostic tree is selected — names the branch section */
  branchSide: "demand" | "supply";
}

function StarBadge() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" aria-hidden="true">
      <path d="M12 2l2.9 6.2 6.6.8-4.9 4.6 1.3 6.5L12 16.9 6.1 20l1.3-6.5L2.5 9l6.6-.8L12 2z" />
    </svg>
  );
}

export function Rail({ currentPageId, onGoTo, branchSide }: RailProps) {
  return (
    <nav className="rail">
      {SECTION_DEFS.map((sec, i) => {
        const active = currentPageId !== null && sec.pages.includes(currentPageId);
        return (
          <div key={sec.entry} className={"sec" + (active ? " active" : "")}>
            <button className="sec-head" onClick={() => onGoTo(sec.entry)}>
              <span className="num">{sec.star ? <StarBadge /> : i + 1}</span>
              {sec.name}
            </button>
            {sec.steps && (
              <ul className="steps">
                {sec.steps.map((step) => (
                  <li key={step.id} className={step.id === currentPageId ? "active" : ""}>
                    <span className="dot"></span>
                    <button onClick={() => onGoTo(step.id)}>
                      {step.branchNamed ? branchSectionName(branchSide) : step.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
