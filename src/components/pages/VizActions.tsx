import { useEffect, useRef, useState } from "react";
import { DownloadIcon } from "../icons";

/** The Data / Image / Share-link button cluster on the right of viz controls. */
export function VizActions() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const share = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
    } catch {
      /* clipboard unavailable — the label feedback still shows */
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="viz-actions">
      <button title="Download the data behind this chart (CSV)">
        <DownloadIcon />
        Data
      </button>
      <button title="Download this chart as an image (PNG)">
        <svg viewBox="0 0 15 13" fill="none">
          <rect x="1" y="1" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="5" cy="4.8" r="1.2" stroke="currentColor" strokeWidth="1.1" />
          <path
            d="m2.5 10.5 3.5-3.5 2.5 2.5 2-2 2 2"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Image
      </button>
      <span className="va-divider"></span>
      <button onClick={share} title="Copy a link to this view">
        <svg viewBox="0 0 15 15" fill="none">
          <path
            d="M6 9l3.5-3.5M5 10.5 3.2 12.3a2.4 2.4 0 0 1-3.4-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0M10 4.5l1.8-1.8a2.4 2.4 0 0 1 3.4 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <span className="share-label">{copied ? "Link copied!" : "Share link"}</span>
      </button>
    </div>
  );
}
