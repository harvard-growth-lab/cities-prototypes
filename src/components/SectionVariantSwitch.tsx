import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CD_VARIANTS, type CdVariant } from "./constraintsVariants";

/** The section study's own control: a dark pill at the bottom left — it
 *  belongs to the study, not the tool — up only while Constraints
 *  Diagnosis is on screen. Drawn into the body: the slot it belongs to sits
 *  inside the scroller, and a fixed element there would ride with it. */
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
    <div className="cd-sv" ref={box}>
      {open && (
        <div className="cd-sv-panel" role="menu" aria-label="Constraints Diagnosis variants">
          {CD_VARIANTS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="menuitemradio"
              aria-checked={s.id === variant}
              className={"cd-sv-opt" + (s.id === variant ? " is-on" : "")}
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
        className={"cd-sv-btn" + (open ? " open" : "")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cd-sv-k">Constraints Diagnosis</span>
        <span className="cd-sv-now">{now.label}</span>
        <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
          <path d="M1 5l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}
