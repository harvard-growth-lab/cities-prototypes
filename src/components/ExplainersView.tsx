import { OpenBookIcon } from "./icons";

/** Pixel-art night skyline thumbnail. Pattern ids are prefixed per card so
 *  the four copies on the grid don't collide. */
function PixelCityThumb({ idPrefix }: { idPrefix: string }) {
  const wA = `${idPrefix}-wA`,
    wB = `${idPrefix}-wB`,
    wC = `${idPrefix}-wC`;
  return (
    <svg viewBox="0 0 400 320" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Pixel city at night">
      <defs>
        <pattern id={wA} width="14" height="16" patternUnits="userSpaceOnUse">
          <rect width="14" height="16" fill="none" />
          <rect x="3" y="4" width="6" height="7" fill="#e8b05c" opacity=".85" />
        </pattern>
        <pattern id={wB} width="13" height="15" patternUnits="userSpaceOnUse">
          <rect width="13" height="15" fill="none" />
          <rect x="3" y="3" width="6" height="7" fill="#cfe3f5" opacity=".9" />
        </pattern>
        <pattern id={wC} width="12" height="14" patternUnits="userSpaceOnUse">
          <rect width="12" height="14" fill="none" />
          <rect x="3" y="3" width="5" height="6" fill="#f2e6c9" opacity=".8" />
        </pattern>
      </defs>
      <rect width="400" height="320" fill="#161b30" />
      <circle cx="352" cy="38" r="16" fill="#e9dfa8" />
      <circle cx="344" cy="32" r="14" fill="#161b30" />
      <circle cx="60" cy="30" r="1.4" fill="#fff" opacity=".8" />
      <circle cx="120" cy="55" r="1.2" fill="#fff" opacity=".6" />
      <circle cx="210" cy="24" r="1.3" fill="#fff" opacity=".7" />
      <circle cx="300" cy="70" r="1.2" fill="#fff" opacity=".5" />
      <circle cx="30" cy="90" r="1.2" fill="#fff" opacity=".5" />
      <rect x="18" y="130" width="92" height="190" fill="#2b2140" />
      <rect x="18" y="130" width="92" height="190" fill={`url(#${wA})`} />
      <rect x="34" y="108" width="8" height="22" fill="#2b2140" />
      <rect x="58" y="102" width="8" height="28" fill="#2b2140" />
      <rect x="122" y="88" width="76" height="232" fill="#252c4a" />
      <rect x="122" y="88" width="76" height="232" fill={`url(#${wC})`} />
      <rect x="150" y="74" width="20" height="14" fill="#354066" />
      <path d="M155 80h10M160 75v10" stroke="#e76565" strokeWidth="3" />
      <rect x="210" y="42" width="104" height="278" fill="#20284a" />
      <rect x="210" y="42" width="104" height="278" fill={`url(#${wB})`} />
      <rect x="326" y="150" width="58" height="170" fill="#272038" />
      <rect x="326" y="150" width="58" height="170" fill={`url(#${wA})`} />
      <g transform="translate(236,272)">
        <rect x="0" y="14" width="9" height="12" fill="#5aa06e" />
        <rect x="11" y="8" width="9" height="18" fill="#c9a44a" />
        <rect x="22" y="4" width="9" height="22" fill="#6a89b5" />
        <rect x="33" y="10" width="9" height="16" fill="#b56a6a" />
        <rect x="44" y="6" width="9" height="20" fill="#8a6ab5" />
        <rect x="0" y="30" width="56" height="3" fill="#c14f4f" />
      </g>
    </svg>
  );
}

function ExplainerCard({ idPrefix }: { idPrefix: string }) {
  return (
    <a
      className="ex-card"
      href="https://github.com/harvard-growth-lab/cities-prototypes"
      target="_blank"
      rel="noopener"
    >
      <span className="ex-thumb">
        <PixelCityThumb idPrefix={idPrefix} />
      </span>
      <span className="ex-title-row">
        <span className="ex-title">How to Read a City</span>
        <span className="ex-read">3min read</span>
      </span>
      <p className="ex-desc">
        Lit windows, moving trucks, cranes, dark storefronts — a city announces exactly how it’s
        doing, all the time, to anyone who knows the code.
      </p>
    </a>
  );
}

export function ExplainersView({ open }: { open: boolean }) {
  return (
    <div className={"explainers-view" + (open ? " open" : "")}>
      <div className="ex-head">
        <OpenBookIcon fill="var(--teal)" />
        <h2>Visual Explainers</h2>
      </div>
      <div className="ex-grid">
        {["exA", "exB", "exC", "exD"].map((prefix) => (
          <ExplainerCard key={prefix} idPrefix={prefix} />
        ))}
      </div>
    </div>
  );
}
