/** Gallery-card art for the diagnostic-tree explainer: the page's own hero
 *  glyph (root → two sides → four leaves, in its branch colors), scaled up
 *  on GL paper over a faint pizza-chart crosshair — the two instruments the
 *  explainer actually reads. */
export function TreeThumb() {
  return (
    <svg viewBox="0 0 400 320" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Abstract diagnostic tree">
      <rect width="400" height="320" fill="#f7f5f0" />
      <g stroke="#e3ded4" strokeWidth="1.5" strokeDasharray="4 5">
        <path d="M 200 24 V 296" />
        <path d="M 36 160 H 364" />
      </g>
      <g transform="translate(80, 82)">
        <g fill="none" strokeWidth={3} strokeLinecap="round">
          <path d="M 120 22 L 120 36 L 60 36 L 60 52" stroke="#3d7ab8" />
          <path d="M 120 22 L 120 36 L 180 36 L 180 52" stroke="#c98500" />
          <path d="M 60 66 L 60 82 L 24 82 L 24 100" stroke="#7059ad" />
          <path d="M 60 66 L 60 82 L 96 82 L 96 100" stroke="#3d7ab8" />
          <path d="M 180 66 L 180 82 L 144 82 L 144 100" stroke="#8a5a00" />
          <path d="M 180 66 L 180 82 L 216 82 L 216 100" stroke="#199e70" />
        </g>
        <circle cx={120} cy={16} r={8} fill="#ffffff" stroke="#a89f91" strokeWidth={1.8} strokeDasharray="3.5 3" />
        <circle cx={60} cy={59} r={7.5} fill="#3d7ab8" fillOpacity={0.85} />
        <circle cx={180} cy={59} r={7.5} fill="#c98500" fillOpacity={0.85} />
        <circle cx={24} cy={106} r={7} fill="#7059ad" fillOpacity={0.8} />
        <circle cx={96} cy={106} r={7} fill="#3d7ab8" fillOpacity={0.8} />
        <circle cx={144} cy={106} r={7} fill="#8a5a00" fillOpacity={0.8} />
        <circle cx={216} cy={106} r={7} fill="#199e70" fillOpacity={0.8} />
      </g>
    </svg>
  );
}
