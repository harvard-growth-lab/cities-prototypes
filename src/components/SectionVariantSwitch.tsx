import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CD_VARIANTS, type CdVariant } from "./constraintsVariants";

/** The section study's own control: the dark pill beside the site study's
 *  ("Site Layout", src/site/SiteLayer.tsx), dressed the same — it belongs
 *  to the study, not the tool — and up only while Constraints Diagnosis is
 *  on screen. Drawn into the body: the slot it belongs to sits inside the
 *  scroller, and a fixed element there would ride with it. */
export function SectionVariantSwitch({
  variant,
  onChange,
}: {
  variant: CdVariant;
  onChange: (v: CdVariant) => void;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const slot = document.getElementById("constraints-slot");
    if (!slot) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => setShown(e.isIntersecting)),
      { root: slot.closest(".pages"), threshold: 0 },
    );
    io.observe(slot);
    return () => io.disconnect();
  }, []);

  /* beside the site pill, wherever its label leaves its edge */
  const [left, setLeft] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!shown) return;
    let site: HTMLElement | null = null;
    const place = () => {
      site = site ?? document.querySelector<HTMLElement>(".site-sv:not(.cd-sv)");
      setLeft(site ? site.getBoundingClientRect().right + 8 : null);
    };
    place();
    /* the site pill mounts once v-3 has booted, which can be after this
       section first comes on screen */
    const ro = new ResizeObserver(place);
    const mo = new MutationObserver(() => {
      if (site) return;
      place();
      if (site) {
        ro.observe(site);
        mo.disconnect();
      }
    });
    if (site) ro.observe(site);
    else mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [shown]);

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
  useEffect(() => {
    if (!shown) setOpen(false);
  }, [shown]);

  if (!shown) return null;
  const now = CD_VARIANTS.find((s) => s.id === variant)!;
  return createPortal(
    <div
      className="site-sv cd-sv"
      ref={box}
      style={left != null ? { left } : undefined}
    >
      {open && (
        <div className="site-sv-panel" role="menu" aria-label="Constraints Diagnosis variants">
          {CD_VARIANTS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="menuitemradio"
              aria-checked={s.id === variant}
              className={"site-sv-opt" + (s.id === variant ? " is-on" : "")}
              onClick={() => {
                setOpen(false);
                if (s.id !== variant) onChange(s.id);
              }}
            >
              <b>{s.label}</b>
              <span>{s.note}</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className={"site-sv-btn" + (open ? " open" : "")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="site-sv-k">Constraints Diagnosis</span>
        <span className="site-sv-now">{now.label}</span>
        <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
          <path d="M1 5l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}
