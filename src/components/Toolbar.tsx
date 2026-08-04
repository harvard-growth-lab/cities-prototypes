import { ASSETS, CITIES, SPANS } from "../data/content";
import { JourneyIcon, OpenBookIcon } from "./icons";

interface ToolbarProps {
  city: string;
  span: string;
  onCityChange: (city: string) => void;
  onSpanChange: (span: string) => void;
  explainersOpen: boolean;
  onToggleExplainers: () => void;
  onOpenChat: () => void;
  onOpenJourney: () => void;
  onLogoClick: () => void;
}

export function Toolbar({
  city,
  span,
  onCityChange,
  onSpanChange,
  explainersOpen,
  onToggleExplainers,
  onOpenChat,
  onOpenJourney,
  onLogoClick,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <button className="logo-btn" onClick={onLogoClick} title="Back to start">
        <img alt="Growth Lab" src={ASSETS.logo} />
      </button>
      <select
        id="citySelectTool"
        className="dd"
        value={city}
        onChange={(e) => onCityChange(e.target.value)}
      >
        {CITIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <select
        id="spanSelectTool"
        className="dd"
        value={span}
        onChange={(e) => onSpanChange(e.target.value)}
      >
        {SPANS.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <div className="spacer"></div>
      <button className="datachat-btn" onClick={onOpenChat}>
        Data Chat
        <span className="beta-tag">beta</span>
      </button>
      <button
        className={"explainers-btn" + (explainersOpen ? " active" : "")}
        onClick={onToggleExplainers}
      >
        <OpenBookIcon />
        Explainers
      </button>
      <nav className="toolbar-links">
        {/* placeholder links; a bare "#" href would clear the routing hash */}
        <a href="#" onClick={(e) => e.preventDefault()}>About</a>
        <a href="#" onClick={(e) => e.preventDefault()}>Glossary</a>
      </nav>
      <button className="btn-journey" onClick={onOpenJourney}>
        <JourneyIcon />
        My Learning Journey
      </button>
    </div>
  );
}
