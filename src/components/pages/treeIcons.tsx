/** The diagram glyphs: one 13x13 line pictogram per tree node and per
 *  evidence theme. Shared by the tree stage (inlined into the drawn SVG and
 *  into the evidence chips), its rail caption, and the branch-analysis
 *  section's theme blocks — so a theme carries the same mark everywhere it
 *  appears rather than being re-drawn per surface.
 *
 *  One lookup, `iconArt`, serves both maps: node art is checked first, so
 *  where an id appears in both — `inputs` is the one case, and it means the
 *  same thing on either side — the node's glyph wins and the theme inherits
 *  it rather than carrying a second copy that could drift.
 *
 *  Every glyph must fit inside the 13x13 box INCLUDING half its 1.4 stroke,
 *  i.e. paint between 0.7 and 12.3. These render into nested <svg> elements,
 *  whose default overflow is hidden, so anything past the edge is silently
 *  cut flat rather than spilling. `scratchpad/bbox.mjs` measures the union
 *  extent of every glyph on the stage if you need to check new art.
 */

/* one tiny pictogram per TREE NODE, in the step icons' line style: raw 13×13
   markup shared by the rail caption (via <NodeGlyph>) and the "node icons"
   styling experiment, which inlines it into the drawn tree */
export const NODE_ICON_ART: Record<string, string> = {
  /* the growth question */
  root: '<circle cx="6.5" cy="6.5" r="5.4"/><path d="M4.9 5a1.6 1.6 0 1 1 2.7 1.2c-.5.5-1.1.8-1.1 1.5"/><circle cx="6.5" cy="9.5" r="0.8" fill="currentColor" stroke="none"/>',
  /* firms and jobs: the briefcase */
  demand:
    '<rect x="1.6" y="4.1" width="9.8" height="6.9" rx="1.4"/><path d="M4.7 4.1v-1A1.2 1.2 0 0 1 5.9 1.9h1.2a1.2 1.2 0 0 1 1.2 1.2v1"/>',
  /* residents: the person */
  supply:
    '<circle cx="6.5" cy="4" r="2.1"/><path d="M2.7 11.2c.5-2.3 2-3.6 3.8-3.6s3.3 1.3 3.8 3.6"/>',
  /* new activities: the spark */
  newact:
    '<path d="M6.5 1.4 7.7 5.3l3.9 1.2-3.9 1.2-1.2 3.9-1.2-3.9-3.9-1.2 3.9-1.2Z"/>',
  /* struggling industries: the falling trend */
  existing:
    '<path d="M1.6 3.9 5 7.3l2-2 3.9 3.9"/><path d="M8.5 9.2h2.4V6.8"/>',
  /* chicken-and-egg: the interlock */
  coord:
    '<circle cx="4.6" cy="6.5" r="3.1"/><circle cx="8.4" cy="6.5" r="3.1"/>',
  /* shocks from outside: the bolt */
  external: '<path d="M7.4 1.5 3.4 7.2h2.8l-.9 4.3 4.3-6H6.8Z"/>',
  /* what firms must buy: the crate (shortened a touch — at its original
     height the bottom vertex' stroke sat just past the box) */
  inputs:
    '<path d="M6.5 1.8 11.2 4.4v5.2L6.5 12.2 1.8 9.6V4.4Z"/><path d="M1.8 4.4 6.5 7l4.7-2.6M6.5 7v5.2"/>',
  /* reach across every firm */
  horizontal:
    '<path d="M1.4 6.5h10.2M3.8 4.1 1.4 6.5l2.4 2.4M9.2 4.1l2.4 2.4-2.4 2.4"/>',
  /* reach down one industry */
  vertical:
    '<path d="M6.5 1.4v10.2M4.1 3.8 6.5 1.4l2.4 2.4M4.1 9.2l2.4 2.4 2.4-2.4"/>',
  /* what living there costs: the price tag */
  col: '<path d="M1.8 1.8h3.9l5.6 5.6a1 1 0 0 1 0 1.4l-2.5 2.5a1 1 0 0 1-1.4 0L1.8 5.7Z"/><circle cx="4.3" cy="4.3" r="0.9" fill="currentColor" stroke="none"/>',
  /* what living there is like: the park tree */
  amen: '<path d="M6.5 1.5 9.4 5.6H7.9l2.6 3.6H2.5l2.6-3.6H3.6Z"/><path d="M6.5 9.2v2.4"/>',
  /* the house */
  housing:
    '<path d="M1.9 6.4 6.5 2.1l4.6 4.3"/><path d="M3.3 5.8v5.4h6.4V5.8"/>',
  /* the bus */
  transport:
    '<rect x="2" y="2.6" width="9" height="6.6" rx="1.3"/><path d="M2 6.2h9"/><circle cx="4.4" cy="10.8" r="1" fill="currentColor" stroke="none"/><circle cx="8.6" cy="10.8" r="1" fill="currentColor" stroke="none"/>',
  /* ----- the alt structure's own leaves -----
     the shock reached past the city limits: rings spreading out from the
     place, the outer pair dashed where they leave the boundary. Radii are
     sized so the outer arcs' bulge plus half the stroke stays inside the
     box — at the first draft they overhung it by 1.1 units a side and the
     nested svg clipped them flat */
  metrowide:
    '<circle cx="6.5" cy="6.5" r="1.4"/><path d="M4.4 8.6a3 3 0 0 1 0-4.2"/><path d="M8.6 4.4a3 3 0 0 1 0 4.2"/><path d="M2.9 10.1a4.8 4.8 0 0 1 0-7.2" stroke-dasharray="1.5 1.7"/><path d="M10.1 2.9a4.8 4.8 0 0 1 0 7.2" stroke-dasharray="1.5 1.7"/>',
  /* the hit stopped at the city limits: the map pin, its head pulled down
     off the top edge so the stroke clears */
  placespec:
    '<path d="M6.5 11.6c2.6-3 3.9-4.8 3.9-6.6a3.9 3.9 0 1 0-7.8 0c0 1.8 1.3 3.6 3.9 6.6Z"/><circle cx="6.5" cy="5" r="1.4"/>',
};

/* one pictogram per THEME, same 13×13 line style as the node icons. These
   ride inside the evidence chips and in the rail caption when a chip is
   hovered — a theme is a kind of evidence, so it reads as a sibling of the
   node glyphs rather than a different vocabulary */
export const THEME_ICON_ART: Record<string, string> = {
  /* know-how deepening or thinning: stacked layers */
  complexity:
    '<path d="M6.5 1.5 11.5 4 6.5 6.5 1.5 4Z"/><path d="M1.5 6.7 6.5 9.2l5-2.5"/><path d="M1.5 9.4 6.5 11.9l5-2.5"/>',
  /* the wider trend the city rides: the wave */
  industryTrends:
    '<path d="M1.3 8.3c1.3 0 1.3-3.4 2.6-3.4S5.2 8.3 6.5 8.3s1.3-3.4 2.6-3.4 1.3 3.4 2.6 3.4"/>',
  /* what the city lost on its own: the diverging pair */
  localShift:
    '<path d="M1.5 6.5h3l2-3.6"/><path d="M6.5 2.9 8.9 6.5h2.6"/><path d="M4.5 6.5l2 3.6 2.4-3.6"/>',
  /* distance from the demand you sell into: the compass */
  remoteness:
    '<circle cx="6.5" cy="6.5" r="5.2"/><path d="M8.8 4.2 5.4 5.4 4.2 8.8l3.4-1.2Z"/>',
  /* new firms and ideas: the bulb */
  innovation:
    '<path d="M4.4 8.1a3.6 3.6 0 1 1 4.2 0v1.3H4.4Z"/><path d="M5.2 11.3h2.6"/>',
  /* NB: the `inputs` theme deliberately has no entry here — its id matches
     the paper tree's Production inputs node, which is the same idea, so it
     resolves to that node's crate and the two can never drift apart */
  /* how much of the job market you can reach: the clock face */
  jobAccess:
    '<circle cx="6.5" cy="6.5" r="5.2"/><path d="M6.5 3.4v3.1l2.3 1.4"/>',
  /* what the place costs: the house with a price arrow */
  housingSupply:
    '<path d="M1.9 6.2 6.5 2l4.6 4.2"/><path d="M3.3 5.7v5.5h6.4V5.7"/><path d="M6.5 9.6V7.1M5.4 8.2l1.1-1.1 1.1 1.1"/>',
  /* the daily journey: the bus */
  commuting:
    '<rect x="2" y="2.6" width="9" height="6.6" rx="1.3"/><path d="M2 6.2h9"/><circle cx="4.4" cy="10.8" r="1" fill="currentColor" stroke="none"/><circle cx="8.6" cy="10.8" r="1" fill="currentColor" stroke="none"/>',
  /* what living here is like: the park tree */
  amenityQuality:
    '<path d="M6.5 1.5 9.4 5.6H7.9l2.6 3.6H2.5l2.6-3.6H3.6Z"/><path d="M6.5 9.2v2.4"/>',
};

/** node art first, then theme art — the two id spaces are disjoint, so one
 *  lookup serves both callers */
export const iconArt = (id: string): string | undefined =>
  NODE_ICON_ART[id] ?? THEME_ICON_ART[id];

export function NodeGlyph({ id }: { id: string }) {
  const art = iconArt(id);
  if (!art) return null;
  return (
    <svg
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: art }}
    />
  );
}
