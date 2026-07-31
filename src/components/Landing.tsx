import { useEffect, useRef } from "react";
import type { TransitionEvent } from "react";
import { ASSETS, CITIES, SPANS } from "../data/content";
import { JourneyIcon } from "./icons";

interface JumpItem {
  label: string;
  target: string;
  icon: React.ReactNode;
}

const JUMP_ITEMS: JumpItem[] = [
  {
    label: "City Overview",
    target: "page-overview",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.4">
        <path d="M2 17h16" />
        <path d="M3.5 17V9h4v8" />
        <path d="M8.5 17V4.5h4.5V17" />
        <path d="M14 17v-6h3v6" />
        <path d="M10.2 7h1.5M10.2 9.5h1.5M10.2 12h1.5" />
      </svg>
    ),
  },
  {
    label: "City Description",
    target: "page-description",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.4">
        <path d="M5 2.5h7.5L16 6v11.5H5V2.5Z" />
        <path d="M12.5 2.5V6H16" />
        <path d="M7.3 9h6.4M7.3 11.7h6.4M7.3 14.4h4.2" />
      </svg>
    ),
  },
  {
    label: "City as part of MSA",
    target: "page-msa",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.4">
        <path d="M2 4.5 7 3l6 2 5-1.5v12L13 17l-6-2-5 1.5v-12Z" strokeLinejoin="round" />
        <path d="M7 3v12M13 5v12" />
      </svg>
    ),
  },
  {
    label: "City’s Exports",
    target: "page-export-basket",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.4">
        <path d="M3 8v8.5h9V8" />
        <path d="M2 5.5h11V8H2z" />
        <path d="M6.3 11h2.4" />
        <path d="M13.5 6.5 18 2m0 0h-3.6M18 2v3.6" />
      </svg>
    ),
  },
  {
    label: "City Constraints",
    target: "page-constraints",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.4">
        <rect x="4" y="9" width="12" height="8.5" rx="1" />
        <path d="M6.8 9V6.4a3.2 3.2 0 0 1 6.4 0V9" />
        <path d="M10 12.4v2.2" />
      </svg>
    ),
  },
  {
    label: "Levers for Change",
    target: "page-levers",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" strokeWidth="1.4">
        <path d="M6 3v14M14 3v14" />
        <circle cx="6" cy="7.5" r="2" fill="white" />
        <circle cx="14" cy="12.5" r="2" fill="white" />
      </svg>
    ),
  },
];

interface LandingProps {
  hidden: boolean;
  up: boolean;
  city: string;
  span: string;
  onCityChange: (city: string) => void;
  onSpanChange: (span: string) => void;
  onEnterTool: (targetId: string) => void;
  onOpenJourney: () => void;
  onSlideTransitionEnd: () => void;
}

export function Landing({
  hidden,
  up,
  city,
  span,
  onCityChange,
  onSpanChange,
  onEnterTool,
  onOpenJourney,
  onSlideTransitionEnd,
}: LandingProps) {
  const touchY = useRef<number | null>(null);

  /* pressing down/page-down/space on the landing flows into the tool */
  useEffect(() => {
    if (hidden) return;
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", " "].includes(e.key)) onEnterTool("page-intro-q1");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hidden, onEnterTool]);

  const handleTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.propertyName === "transform") onSlideTransitionEnd();
  };

  return (
    <div
      id="landing"
      className={(up ? "up " : "") + (hidden ? "hidden" : "")}
      onTransitionEnd={handleTransitionEnd}
      onWheel={(e) => {
        if (e.deltaY > 8) onEnterTool("page-intro-q1");
      }}
      onTouchStart={(e) => {
        touchY.current = e.touches[0].clientY;
      }}
      onTouchMove={(e) => {
        if (touchY.current !== null && touchY.current - e.touches[0].clientY > 30) {
          touchY.current = null;
          onEnterTool("page-intro-q1");
        }
      }}
    >
      <div className="map-bg"></div>

      <header className="landing-header">
        <img className="logo" alt="Growth Lab" src={ASSETS.logo} />
        <button className="btn-journey" style={{ height: 38 }} onClick={onOpenJourney}>
          <JourneyIcon />
          My Learning Journey
        </button>
      </header>

      <div className="landing-hero">
        <h1>Cities Tool</h1>
        <p className="intro">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Proin tortor purus platea sit eu id nisi litora libero.
          Neque vulputate consequat ac amet augue blandit maximus aliquet congue.
        </p>

        <div className="selector-card">
          <div className="field">
            <label htmlFor="citySelect">Select a city</label>
            <select
              id="citySelect"
              className="dd"
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
            >
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="spanSelect">Time span comparison</label>
            <select
              id="spanSelect"
              className="dd"
              value={span}
              onChange={(e) => onSpanChange(e.target.value)}
            >
              {SPANS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <button className="btn-orange" onClick={() => onEnterTool("page-overview")}>
            Start Exploring
          </button>
        </div>

        <div className="jump-wrap">
          <span className="jump-label">Jump to Section</span>
          <div className="jump-row">
            {JUMP_ITEMS.map((item) => (
              <button key={item.target} className="jump-item" onClick={() => onEnterTool(item.target)}>
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="landing-bottom">
        <button className="start-scrolling" onClick={() => onEnterTool("page-intro-q1")}>
          <span className="ss-row">
            Start Scrolling
            <svg className="ss-chev" viewBox="0 0 16 9" fill="none" aria-hidden="true">
              <path
                d="M1.5 1.5 8 7.5l6.5-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <svg
            className="city-build"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            aria-hidden="true"
          >
            <path d="M2 17h16" />
            <path className="cb-b cb-1" d="M3.5 17V9h4v8" />
            <path className="cb-b cb-2" d="M8.5 17V4.5h4.5V17" />
            <path className="cb-b cb-3" d="M14 17v-6h3v6" />
            <path className="cb-w" d="M10.2 7h1.5M10.2 9.5h1.5M10.2 12h1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
