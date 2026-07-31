/**
 * Variant 04 — the codex. The tree flattened into fourteen entries of
 * running prose in figure order, with the tree itself standing in the
 * margin as a live index: scroll and the lit path is always the ancestry
 * of the entry under the reading line. Click any node to jump to its
 * entry — the docs-sidebar pattern, except the sidebar is the tree.
 */

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { DFS, pathTo, SHORT, SIDE_COLOR, SIDE_LABEL, type TNode } from "./model";
import { prefersReducedMotion } from "./useInView";

function Entry({ n, here }: { n: TNode; here: boolean }) {
  const c = SIDE_COLOR[n.side];
  return (
    <article
      id={`tl-cdx-${n.id}`}
      data-node={n.id}
      className={`tl-codex-entry${here ? " here" : ""}`}
      style={
        {
          "--indent": `${n.depth * 16}px`,
          borderLeftColor: here ? c.base : c.tint,
        } as CSSProperties
      }
    >
      <div className="tl-codex-crumb">
        <span className="tl-side-chip" data-side={n.side}>
          {SIDE_LABEL[n.side]}
        </span>
        <span className="tl-codex-depth">
          {n.depth === 0 ? "the question" : `depth ${n.depth}`}
        </span>
      </div>
      <h4>{n.title}</h4>
      {n.sub && <div className="tl-wall-sub">{n.sub}</div>}
      <p>{n.detail}</p>
      {n.example && (
        <p className="tl-wall-meta">
          <b>Case</b> {n.example}
        </p>
      )}
      {n.tests && (
        <p className="tl-wall-meta">
          <b>Tests</b> {n.tests}
        </p>
      )}
    </article>
  );
}

export function Codex() {
  const [active, setActive] = useState("root");
  const docRef = useRef<HTMLDivElement | null>(null);

  // scroll-spy: whichever entry crosses the reading band owns the index
  useEffect(() => {
    const doc = docRef.current;
    if (!doc) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.node!);
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    doc.querySelectorAll<HTMLElement>("[data-node]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const path = pathTo(active).map((n) => n.id);
  const jump = (id: string) =>
    document.getElementById(`tl-cdx-${id}`)?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });

  return (
    <div className="tl-codex">
      <nav className="tl-codex-map" aria-label="Tree index — follows the entry being read">
        <div className="tl-codex-map-head">Figure 27 · the index</div>
        {DFS.map((n) => {
          const lit = path.includes(n.id);
          const c = SIDE_COLOR[n.side];
          return (
            <button
              key={n.id}
              className={`tl-codex-row${lit ? " lit" : ""}${n.id === active ? " here" : ""}`}
              style={{ "--indent": `${8 + n.depth * 15}px` } as CSSProperties}
              aria-current={n.id === active || undefined}
              onClick={() => jump(n.id)}
            >
              <span
                className="dot"
                style={{
                  background: lit ? c.base : "transparent",
                  borderColor: lit ? c.base : "#c6bfb2",
                }}
              />
              <span style={{ color: lit ? c.deep : undefined }}>{SHORT[n.id]}</span>
            </button>
          );
        })}
        <div className="tl-codex-map-hint">follows your reading · click to jump</div>
      </nav>

      <div className="tl-codex-doc" ref={docRef}>
        {DFS.map((n) => (
          <Entry key={n.id} n={n} here={n.id === active} />
        ))}
      </div>
    </div>
  );
}
