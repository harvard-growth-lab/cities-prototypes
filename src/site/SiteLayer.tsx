import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LegacyApi } from "../legacy/bridge";
import { firstOfPart, partOf, seamSections, type SiteSlots } from "./runtime";
import { PARTS, SITE_VARIANTS, hrefForVariant, type SiteVariant } from "./variants";

/* What the site-level layout variants draw (see variants.ts for the study):
   the crossing between the tool's two halves in each variant's own form —
   a threshold band in the one scroll, a title page in the chapters' Prev /
   Next sequence, a hand-off at the foot of the profile in the two modes —
   plus the modes' switch and recall in the section bar, and the control
   that moves between the variants. Copy is placeholder throughout: the
   study is the organisation, not the words. */

interface SiteLayerProps {
  api: LegacyApi;
  variant: SiteVariant;
  slots: SiteSlots;
  /** the section v-3's switch is on */
  section: number;
  /** the tool is on screen (not the landing) */
  inTool: boolean;
}

export function SiteLayer({ api, variant, slots, section, inTool }: SiteLayerProps) {
  const { last, first } = seamSections();
  const go = useCallback((i: number) => api.showSection(i), [api]);

  /* ---- chapters: the title page is a stop in the pager's sequence ----
     Prev / Next across the crossing land on it, in either direction; the
     tabs stay what they are on main, a jump straight to a section. */
  const [gate, setGate] = useState(false);
  useEffect(() => {
    if (variant !== "chapters") return;
    const pager = document.querySelector<HTMLElement>(".secpager");
    const nav = document.querySelector<HTMLElement>(".secbar");
    if (!pager) return;
    /* capture, so v-3's own listener on the pager never sees the click */
    const onPager = (e: MouseEvent) => {
      const b = (e.target as Element).closest<HTMLElement>(".pager-btn");
      if (!b) return;
      const from = Number(pager.dataset.sec);
      const to = Number(b.dataset.go);
      if (partOf(from) < 0 || partOf(to) < 0 || partOf(from) === partOf(to)) return;
      e.stopPropagation();
      setGate(true);
    };
    /* any tab (or the phone's menu) leaves the title page, including the tab
       of the section it was reached from, which the switch itself ignores */
    const onNav = (e: MouseEvent) => {
      if ((e.target as Element).closest(".secnav-btn, .secmenu-opt")) setGate(false);
    };
    pager.addEventListener("click", onPager, true);
    nav?.addEventListener("click", onNav);
    return () => {
      pager.removeEventListener("click", onPager, true);
      nav?.removeEventListener("click", onNav);
    };
  }, [variant]);
  useEffect(() => setGate(false), [section]);
  useEffect(() => {
    const h = document.documentElement;
    if (!gate) {
      delete h.dataset.siteGate;
      return;
    }
    h.dataset.siteGate = "1";
    document.getElementById("pages")?.scrollTo({ top: 0, behavior: "instant" });
    return () => {
      delete h.dataset.siteGate;
    };
  }, [gate]);
  const leaveGate = (to: number) => {
    setGate(false);
    go(to);
  };

  const name = (i: number) => api.sectionDefs[i]?.name ?? "";

  return (
    <>
      {variant === "scroll" && slots.seam && createPortal(
        <PartSeam api={api} onRevisit={go}>
          <p className="seam-cue">
            keep scrolling to begin
            <Arrow dir="down" />
          </p>
        </PartSeam>,
        slots.seam,
      )}

      {variant === "chapters" && gate && slots.seam && createPortal(
        <PartSeam api={api} onRevisit={leaveGate} page>
          <div className="seam-pager">
            <button type="button" className="seam-btn" onClick={() => leaveGate(last)}>
              <Arrow dir="left" />
              {name(last)}
            </button>
            <button type="button" className="seam-btn seam-btn--go" onClick={() => leaveGate(first)}>
              Begin · {name(first)}
              <Arrow dir="right" />
            </button>
          </div>
        </PartSeam>,
        slots.seam,
      )}

      {variant === "modes" && slots.seam && createPortal(
        <PartHandoff onGo={() => go(first)} firstName={name(first)} />,
        slots.seam,
      )}
      {variant === "modes" && slots.mode && createPortal(
        <ModeSwitch section={section} onGo={go} />,
        slots.mode,
      )}
      {variant === "modes" && slots.recall && partOf(section) === 1 && createPortal(
        <ProfileRecall api={api} onOpen={go} />,
        slots.recall,
      )}

      {inTool && <SiteVariantSwitch variant={variant} />}
    </>
  );
}

/* ---------- shared bits ---------- */

/** the placeholder idiom (figures.css .ph): bracketed, italic, dashed */
const Ph = ({ children }: { children: ReactNode }) => <span className="ph">[{children}]</span>;

function Arrow({ dir }: { dir: "left" | "right" | "down" }) {
  const rot = dir === "left" ? 180 : dir === "down" ? 90 : 0;
  return (
    <svg
      className="site-arrow"
      viewBox="0 0 16 10"
      width="16"
      height="10"
      aria-hidden="true"
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <path d="M1 5h13M10 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CHECK = (
  <svg viewBox="0 0 10 8" width="9" height="7" aria-hidden="true">
    <path d="M1 4.2 3.7 6.8 9 1.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/** the sections of one half, with the numbers the tabs give them */
const sectionsOf = (api: LegacyApi, part: 0 | 1) =>
  api.sectionDefs.map((sd, i) => ({ name: sd.name, i })).filter((s) => partOf(s.i) === part);

/* ---------- the crossing: what part one hands to part two ----------
   One board in both of its settings — a band in the one scroll, a page in
   the chapters: the three sections just read, filed on the left as what the
   reader brings; the two ahead on the right as what is done with it. */

function PartSeam({
  api,
  onRevisit,
  page = false,
  children,
}: {
  api: LegacyApi;
  onRevisit: (i: number) => void;
  /** a page of its own (chapters) rather than a band in the scroll */
  page?: boolean;
  /** the foot: a scroll cue, or the page's Prev / Next */
  children: ReactNode;
}) {
  const [one, two] = PARTS;
  return (
    <section className={"seam" + (page ? " seam--page" : "")} aria-labelledby="seam-title">
      <div className="seam-in">
        <header className="seam-head">
          <p className="seam-eyebrow">Part {two.n} of 2</p>
          <h2 id="seam-title">{two.name}</h2>
          <p className="seam-lede">
            <Ph>placeholder: part one described the city. part two uses it</Ph>
          </p>
        </header>

        <div className="seam-board">
          <div className="seam-group seam-group--done">
            <p className="seam-tag">
              <b>Part {one.n} · {one.name}</b>
              <span>what you bring</span>
            </p>
            <ul>
              {sectionsOf(api, 0).map((s) => (
                <li key={s.i} className="seam-card">
                  <span className="seam-num">{CHECK}</span>
                  <b>{s.name}</b>
                  <Ph>placeholder: takeaway</Ph>
                  <button type="button" className="seam-link" onClick={() => onRevisit(s.i)}>
                    Revisit
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="seam-join" aria-hidden="true">
            <span>builds on</span>
            <Arrow dir="right" />
          </div>

          <div className="seam-group seam-group--next">
            <p className="seam-tag">
              <b>Part {two.n} · {two.name}</b>
              <span>what you do with it</span>
            </p>
            <ol>
              {sectionsOf(api, 1).map((s) => (
                <li key={s.i} className="seam-card">
                  <span className="seam-num">{s.i + 1}</span>
                  <b>{s.name}</b>
                  <Ph>placeholder: what this step asks of you</Ph>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <footer className="seam-foot">{children}</footer>
      </div>
    </section>
  );
}

/* ---------- two modes ---------- */

/** the hand-off at the foot of the profile: the modes' crossing is the
 *  switch in the bar, so the page only has to offer it */
function PartHandoff({ onGo, firstName }: { onGo: () => void; firstName: string }) {
  const two = PARTS[1];
  return (
    <aside className="handoff">
      <div className="handoff-txt">
        <p className="seam-eyebrow">Next · Part {two.n}</p>
        <h2>{two.name}</h2>
        <p>
          <Ph>placeholder: what the diagnosis does with this profile</Ph>
        </p>
      </div>
      <button type="button" className="handoff-btn" onClick={onGo}>
        Start · {firstName}
        <Arrow dir="right" />
      </button>
    </aside>
  );
}

/** the two halves as the bar's first choice; each remembers where it was left */
function ModeSwitch({ section, onGo }: { section: number; onGo: (i: number) => void }) {
  const part = partOf(section);
  const left = useRef<[number, number]>([firstOfPart(0), firstOfPart(1)]);
  if (part !== -1) left.current[part] = section;
  return (
    <div className="modes" role="group" aria-label="Parts of the tool">
      {PARTS.map((p, pi) => (
        <button
          key={p.n}
          type="button"
          className={"modes-btn" + (part === pi ? " is-on" : "")}
          aria-pressed={part === pi}
          onClick={() => part !== pi && onGo(left.current[pi])}
        >
          <small>Part {p.n}</small>
          {p.name}
        </button>
      ))}
    </div>
  );
}

/** the profile on call while diagnosing: part two is built on part one, so
 *  part one stays one click away without leaving the step */
function ProfileRecall({ api, onOpen }: { api: LegacyApi; onOpen: (i: number) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div className="recall" ref={box}>
      <button
        type="button"
        className={"recall-btn" + (open ? " open" : "")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {PARTS[0].name}
        <svg viewBox="0 0 12 8" width="10" height="7" aria-hidden="true">
          <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="recall-panel" role="dialog" aria-label={`${PARTS[0].name}, in brief`}>
          <p className="recall-head">
            <b>Part 1 · {PARTS[0].name}</b>
            <span>in brief, while you diagnose</span>
          </p>
          <ul>
            {sectionsOf(api, 0).map((s) => (
              <li key={s.i} className="recall-card">
                <b>{s.name}</b>
                <Ph>placeholder: headline figure</Ph>
                <Ph>placeholder: takeaway</Ph>
                <button type="button" className="seam-link" onClick={() => onOpen(s.i)}>
                  Open section
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- the study's own control ---------- */

/** Bottom-left, off the page's own chrome: it belongs to the study, not the
 *  tool. Choosing a variant is a navigation (see variants.ts), to the same
 *  place in the tool. */
function SiteVariantSwitch({ variant }: { variant: SiteVariant }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const now = SITE_VARIANTS.find((s) => s.id === variant)!;

  return (
    <div className="sv" ref={box}>
      {open && (
        <div className="sv-panel" role="menu" aria-label="Site layout variants">
          {SITE_VARIANTS.map((s) => (
            <a
              key={s.id}
              role="menuitemradio"
              aria-checked={s.id === variant}
              className={"sv-opt" + (s.id === variant ? " is-on" : "")}
              href={hrefForVariant(s.id)}
              onClick={(e) => {
                /* a hash-only difference would not reload the page */
                e.preventDefault();
                if (s.id === variant) return setOpen(false);
                window.location.assign(hrefForVariant(s.id));
              }}
            >
              <b>{s.label}</b>
              <span>{s.note}</span>
            </a>
          ))}
        </div>
      )}
      <button
        type="button"
        className={"sv-btn" + (open ? " open" : "")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sv-k">Site layout</span>
        <span className="sv-now">{now.label}</span>
        <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
          <path d="M1 5l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
