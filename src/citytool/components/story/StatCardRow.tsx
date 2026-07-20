import type { StatCard } from '../../lib/storyStats';
import { useYearRange } from '../../lib/yearRange';

// The story's headline stats as a compact print-style table — same idiom as
// the profile pages' levels table. One row per indicator; the level, the
// change over the compare window, and the peer rank sit in columns at the same
// visual weight. (This replaced a grid of stat cards whose value/change/rank
// hierarchy buried the change and rank in progressively fainter type.)

export default function StatCardRow({
  cards,
  rankLabel = 'in MSA',
}: {
  cards: StatCard[];
  rankLabel?: string;
}) {
  const { startYear } = useYearRange();
  return (
    <table className="levels-table story-levels">
      <thead>
        <tr>
          <th>Indicator</th>
          <th className="col-num">Level</th>
          <th className="col-num">Change since {startYear}</th>
          <th className="col-num">Rank {rankLabel}</th>
        </tr>
      </thead>
      <tbody>
        {cards.map((c) => {
          // `tone` (when set) drives the colour so indicators where down is
          // good — unemployment — read green on a fall; otherwise the arrow
          // direction sets it.
          const up = c.tone === 'good' || (c.tone == null && c.changeDir === 1);
          const down = c.tone === 'bad' || (c.tone == null && c.changeDir === -1);
          return (
            <tr key={c.key}>
              <td>
                <span className="indicator-name">{c.label}</span>
                {c.note && <span className="indicator-note">{c.note}</span>}
              </td>
              <td className="col-num value">{c.value}</td>
              <td className="col-num">
                {c.change != null ? (
                  <span className={`change${up ? ' is-up' : down ? ' is-down' : ''}`}>
                    {c.changeDir === 1 ? '↑ ' : c.changeDir === -1 ? '↓ ' : ''}
                    {c.change}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="col-num">
                {c.rank ? (
                  <>
                    {c.rank.rank} <span className="rank-of">/ {c.rank.total}</span>
                  </>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
