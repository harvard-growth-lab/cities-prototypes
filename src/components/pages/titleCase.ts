/* ---------- title case for the analysis cards (Sept 2026, the user's call) ----------
   The data points are named in sentence case in the spec's own words
   (src/data/figures.ts, the module data files) and the charts write their
   labels the same way; the cards and the charts set titles and labels in
   Title Case at render time, so the data stays the spec's and every card
   agrees. Small words stay down except first and last; a word
   that already carries capitals (MSA, RCA, ECI, e.g.) is left alone; both
   halves of a hyphenated word rise. */
const SMALL_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on",
  "or", "per", "the", "to", "vs", "v", "via", "e.g", "i.e",
]);
const capWord = (w: string) =>
  /[A-Z]/.test(w) || /^\d/.test(w)
    ? w
    : w.replace(/^([("']*)([a-z])/, (_, pre, c) => pre + c.toUpperCase());
/** anything a label can be: a number or a missing name passes through */
export const titleCase = (v: string | number | null | undefined): string => {
  if (typeof v !== "string") return v == null ? "" : String(v);
  const s = v;
  const words = s.split(" ");
  return words
    .map((w, i) => {
      /* the bare word: no brackets, no trailing punctuation (so "(e.g." is
         checked as "e.g") */
      const bare = w.replace(/^[("']+|[)"',.:;]+$/g, "");
      const small = SMALL_WORDS.has(bare.toLowerCase());
      const edge = i === 0 || i === words.length - 1;
      /* the word after a colon opens a new phrase and rises too */
      const afterColon = i > 0 && /:$/.test(words[i - 1]);
      if (small && !edge && !afterColon) return w;
      return w
        .split("-")
        .map((part, j) =>
          j > 0 && SMALL_WORDS.has(part.toLowerCase()) ? part : capWord(part),
        )
        .join("-");
    })
    .join(" ");
};
