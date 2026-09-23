import type { ModuleDef } from "../../data/figures";
import { NodeGlyph } from "./treeIcons";

/* ---------- module chips (Sept 2026, the user's call) ----------
   One way of naming a data module wherever a list of them appears — the
   analysis schematic's rail and the sandbox's read panel: the module's
   glyph and its name in the branch's colour on a faint tint of it, no level
   pill and no count. A chip is a link where the list navigates (the rail
   scroll-spies the section and opens folded layouts) and plain text where
   it only names (the sandbox, whose "Read this ending's analysis" is the
   way in). `active` is the rail's scroll-spy: the others fall back. */
export function ModuleChips({
  modules,
  color,
  activeId,
  hrefFor,
  onPick,
}: {
  modules: ModuleDef[];
  color: string;
  /** the module in view, where the list scroll-spies; the rest dim */
  activeId?: string | null;
  /** makes each chip a link */
  hrefFor?: (m: ModuleDef) => string;
  onPick?: (m: ModuleDef) => void;
}) {
  const spy = activeId !== undefined;
  return (
    <ul className="mod-chips">
      {modules.map((m) => {
        const on = !spy || m.id === activeId;
        const body = (
          <>
            <span className="mod-chip-ico" aria-hidden="true">
              <NodeGlyph id={m.id} />
            </span>
            <b>{m.title}</b>
          </>
        );
        const style = {
          borderColor: color,
          color,
          background: `color-mix(in srgb, ${color} 8%, #fff)`,
        };
        return (
          <li key={m.id} className={"mod-chip" + (on ? " on" : "")}>
            {hrefFor ? (
              <a
                href={hrefFor(m)}
                style={style}
                aria-current={spy && on ? "true" : undefined}
                onClick={() => onPick?.(m)}
              >
                {body}
              </a>
            ) : (
              <span style={style}>{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
