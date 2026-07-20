// Stable, URL-safe slug. Matches the route :citySlug / :countySlug params.
export function citySlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Same algorithm — kept as a distinct export so call sites read clearly.
export const countySlug = citySlug;

// Place slugs include the 2-letter state to disambiguate (e.g. Springfield IL
// vs MA vs MO). Format: "<place-name>-<state>" all lowercased.
export function placeSlug(name: string, state: string): string {
  return `${citySlug(name)}-${state.toLowerCase()}`;
}

// Parse a place slug back into (name, state) — splits on the last '-'.
// Returns null if the slug doesn't have a trailing 2-letter state.
export function parsePlaceSlug(slug: string): { name: string; state: string } | null {
  const m = slug.match(/^(.+)-([a-z]{2})$/);
  if (!m) return null;
  return { name: m[1], state: m[2].toUpperCase() };
}
