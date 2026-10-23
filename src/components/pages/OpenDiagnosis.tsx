import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DATA_LEVEL_LABEL, MODULES, TREE_SIDE_COLOR } from "../../data/figures";
import {
  liveCount,
  rankModules,
  runTests,
  type ModuleRelevance,
  type TestId,
  type TestResult,
} from "../../data/diagTests";
import type { OpenVariant } from "../constraintsVariants";
import { ModuleBlock } from "./BranchAnalysisPage";
import { GeoBadge } from "./ConstraintNarrative";
import { ModuleChips } from "./moduleChips";
import { QuadGlyph } from "./quadIcons";
import { TestChart } from "./testCharts";
import { titleCase } from "./titleCase";
import { NodeGlyph } from "./treeIcons";
import { NARROW_QUERY, useMediaQuery } from "./walkFit";

/* ---------- the open-ended diagnosis (Oct 2026) — a STUDY ----------
   Three tellings of the same approach, swapped in for the whole section by
   the section study's pill: several tests read the city's data, each points
   at modules, the modules most tests point at are suggested, and any module
   can be read (the tests and the ranking: src/data/diagTests.ts).

     guided    a scrolly: one test a stop on the sticky stage, the nine
               modules underneath gathering a pip for every test that points
               at them; the last stop ranks them. Then the board, then the
               reading list.
     bench     every test at once as cards, the board under them, the
               reading list under that.
     explorer  module-first: the tests a strip of chips (each opens its
               card), the modules a ranked list beside the one open module.

   The reading list is shared by the first two and outlives a switch between
   them; it starts as the suggestions and resets with the city. The copy is
   placeholder; the data — the tests' figures, the charts, the modules — is
   real for Boston and made up for the placeholder cities. */

/** modules carry no branch any more, so they wear the section's teal */
const MOD_COLOR = TREE_SIDE_COLOR.demand;

/** what the pointer is on — a test or a module. It lights the OTHER kind:
 *  a test lights the modules it points at and puts the rest back, a module
 *  the tests that point at it; its own kind stays as it is */
type Hot = { test?: TestId; module?: string } | null;
const testState = (hot: Hot, r: TestResult) =>
  !hot
    ? ""
    : hot.test
      ? hot.test === r.test.id
        ? " is-hot"
        : ""
      : r.modules.includes(hot.module!)
        ? " is-hot"
        : " is-dim";
const moduleState = (hot: Hot, id: string, results: TestResult[]) =>
  !hot
    ? ""
    : hot.module
      ? hot.module === id
        ? " is-hot"
        : ""
      : results.find((r) => r.test.id === hot.test)?.modules.includes(id)
        ? " is-hot"
        : " is-dim";

const scrollToId = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/* ---------- a test's result ---------- */

function Outcome({ r }: { r: TestResult }) {
  const live = r.status === "live";
  return (
    <p className={"ba-step-verdict od-outcome" + (live ? "" : " rubric")}>
      <span
        className="ba-verdict-dot"
        aria-hidden="true"
        style={live ? { background: r.color } : undefined}
      />
      <span>
        {r.side && <QuadGlyph side={r.side} color={r.color} />}
        <b style={live ? { color: r.color } : undefined}>{titleCase(r.outcome)}</b>
        {r.figures && <span className="ba-verdict-why"> · {r.figures}</span>}
      </span>
    </p>
  );
}

function PointsTo({ r }: { r: TestResult }) {
  if (r.status === "nodata") return null;
  const mods = r.modules.map((id) => MODULES[id]);
  return (
    <div className={"od-points" + (r.status === "tocome" ? " pending" : "")}>
      <span className="od-points-k">
        {r.status === "tocome"
          ? "Would Point To"
          : mods.length
            ? "Points To"
            : "Points to No Module"}
      </span>
      {mods.length > 0 && <ModuleChips modules={mods} color={MOD_COLOR} />}
    </div>
  );
}

/** a test as a card — the analysis cards' own frame: title and level, the
 *  instrument in its well, the result and the modules it points at */
function TestCard({
  r,
  city,
  hot,
  onHover,
}: {
  r: TestResult;
  city: string;
  hot?: Hot;
  onHover?: (h: Hot) => void;
}) {
  return (
    <figure
      className={
        "ba-step od-test" +
        (r.status === "live" ? "" : " ba-step--ph") +
        testState(hot ?? null, r)
      }
      onPointerEnter={() => onHover?.({ test: r.test.id })}
      onPointerLeave={() => onHover?.(null)}
    >
      <div className="ba-step-head">
        <span className="ba-step-ask">{r.test.title}</span>
        <span className="ba-step-name">
          <span className="ba-level small">{DATA_LEVEL_LABEL[r.test.level]}</span>
        </span>
      </div>
      <div className="ba-step-well">
        <TestChart id={r.test.id} city={city} />
        {r.status === "tocome" && <span className="ba-step-tag">Placeholder</span>}
      </div>
      <figcaption>
        <Outcome r={r} />
        <PointsTo r={r} />
      </figcaption>
    </figure>
  );
}

/* ---------- a module's evidence ---------- */

/** one pip per test, in the tests' order, filled in the test's colour where
 *  it points at the module, dashed where a test to come would; `upTo` keeps
 *  the later ones blank (the guided stage reveals them a test at a time) */
function Pips({
  id,
  results,
  upTo = results.length,
}: {
  id: string;
  results: TestResult[];
  upTo?: number;
}) {
  const n = results.filter(
    (r, i) => i < upTo && r.status === "live" && r.modules.includes(id),
  ).length;
  return (
    <span className="od-pips" role="img" aria-label={`${n} of ${results.length} tests point here`}>
      {results.map((r, i) => {
        const shown = i < upTo;
        const on = shown && r.status === "live" && r.modules.includes(id);
        const pend = shown && r.status === "tocome" && r.modules.includes(id);
        return (
          <i
            key={r.test.id}
            className={on ? "on" : pend ? "pend" : shown ? "" : "later"}
            style={on ? { background: r.color, borderColor: r.color } : undefined}
            title={r.test.title}
          />
        );
      })}
    </span>
  );
}

/** why a module is where it is, in a few words */
const whyLine = (rel: ModuleRelevance) =>
  rel.by.length
    ? rel.by.map((r) => r.test.title).join(", ")
    : rel.standing
      ? "Read for every city"
      : rel.pending.length
        ? "A test to come points here"
        : "No test points here";

/* ---------- the board: every module, the suggested ones first ---------- */

function ModuleBoard({
  city,
  rels,
  results,
  picked,
  onToggle,
  onReset,
  hot,
  onHover,
}: {
  city: string;
  rels: ModuleRelevance[];
  results: TestResult[];
  picked: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onReset: () => void;
  hot: Hot;
  onHover: (h: Hot) => void;
}) {
  const groups = [
    { k: `Suggested for ${city}`, rels: rels.filter((r) => r.suggested) },
    { k: "Other Modules", rels: rels.filter((r) => !r.suggested) },
  ];
  const isDefault =
    picked.size === groups[0].rels.length &&
    groups[0].rels.every((r) => picked.has(r.module.id));
  return (
    <div className="od-board">
      {groups.map((g) => (
        <div className="od-board-group" key={g.k}>
          <div className="od-board-k">
            {g.k} <span>{g.rels.length}</span>
          </div>
          <ul className="od-mods">
            {g.rels.map((rel) => {
              const id = rel.module.id;
              const on = picked.has(id);
              return (
                <li key={id} className={moduleState(hot, id, results).trim()}>
                  <button
                    type="button"
                    className={"od-mod" + (on ? " picked" : "") + (rel.suggested ? " sugg" : "")}
                    aria-pressed={on}
                    onClick={() => onToggle(id)}
                    onPointerEnter={() => onHover({ module: id })}
                    onPointerLeave={() => onHover(null)}
                  >
                    <span className="od-mod-ico" aria-hidden="true">
                      <NodeGlyph id={id} />
                    </span>
                    <span className="od-mod-txt">
                      <b>{rel.module.title}</b>
                      <span className="od-mod-lvl">{DATA_LEVEL_LABEL[rel.module.level]}</span>
                    </span>
                    <span className="od-check" aria-hidden="true">
                      <svg viewBox="0 0 12 10">
                        <path d="M1.5 5.2 4.6 8.2 10.5 1.8" />
                      </svg>
                    </span>
                    <span className="od-mod-why">
                      <Pips id={id} results={results} />
                      <span>{whyLine(rel)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="od-board-foot">
        <span>
          <b>{picked.size}</b> of {rels.length} modules in the reading list
        </span>
        {!isDefault && (
          <button type="button" className="od-link" onClick={onReset}>
            Reset to the suggestions
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- the reading list: the picked modules, read in full ---------- */

function ReadingList({
  city,
  rels,
  picked,
}: {
  city: string;
  rels: ModuleRelevance[];
  picked: ReadonlySet<string>;
}) {
  const mods = rels.filter((r) => picked.has(r.module.id)).map((r) => r.module);
  if (!mods.length)
    return (
      <p className="od-empty">
        <span className="ph">[no modules chosen. add any module from the board above]</span>
      </p>
    );
  return (
    <>
      <nav className="od-jump" aria-label="Modules in the reading list">
        {mods.map((m) => (
          <button
            key={m.id}
            type="button"
            className="od-jump-btn"
            onClick={() => scrollToId(`od-module-${m.id}`)}
          >
            <span className="od-jump-ico" aria-hidden="true">
              <NodeGlyph id={m.id} />
            </span>
            {m.title}
          </button>
        ))}
      </nav>
      <div className="ba-ending ba-lay-float ba-full od-reading">
        <div className="ba-modules">
          {mods.map((m) => (
            <ModuleBlock
              key={m.id}
              def={m}
              color={MOD_COLOR}
              cityShort={city}
              id={`od-module-${m.id}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/** the section's head in the variants that open on a page rather than a
 *  scrolly — the analysis's own heavy title */
function SectionHead() {
  return (
    <div className="page-head od-head">
      <h2>Constraints Diagnosis</h2>
      <p className="lede">
        <span className="ph">
          [placeholder: the tests read the city&rsquo;s data and suggest where to
          look. any module can be opened]
        </span>
      </p>
    </div>
  );
}

function BlockHead({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="od-block-head">
      <h3>{title}</h3>
      {aside && <span className="od-count">{aside}</span>}
    </div>
  );
}

/* ---------- guided: one test a stop ---------- */

/** the stage's lower half: the nine modules, gathering a pip for each test
 *  as it is read, the ones the current test points at lit; on the last stop
 *  they re-sort by how many tests point at them and the suggestions light */
function Tally({
  rels,
  results,
  upTo,
  current,
  final,
}: {
  rels: ModuleRelevance[];
  results: TestResult[];
  upTo: number;
  current: TestResult | null;
  final: boolean;
}) {
  const specOrder = Object.keys(MODULES);
  const ranked = rels.map((r) => r.module.id);
  return (
    <div className={"od-tally" + (final ? " final" : "")}>
      {rels.map((rel) => {
        const id = rel.module.id;
        const k = (final ? ranked : specOrder).indexOf(id);
        const lit = !!current && current.status === "live" && current.modules.includes(id);
        /* a test to come marks what it WOULD point at, dashed */
        const would = !!current && current.status === "tocome" && current.modules.includes(id);
        const state = final
          ? rel.suggested
            ? " sugg"
            : " rest"
          : lit
            ? " lit"
            : would
              ? " would"
              : "";
        return (
          <div
            key={id}
            className={"od-tile" + state}
            style={
              {
                "--col": k % 3,
                "--row": Math.floor(k / 3),
                "--c": current?.color ?? MOD_COLOR,
              } as CSSProperties
            }
          >
            <span className="od-tile-ico" aria-hidden="true">
              <NodeGlyph id={id} />
            </span>
            <span className="od-tile-txt">
              <b>{rel.module.title}</b>
              <Pips id={id} results={results} upTo={upTo} />
              <span className="od-tile-why">{whyLine(rel)}</span>
              {/* the ranked stop has room for the question the module asks */}
              <span className="od-tile-q">
                {rel.module.question ?? "[question to come]"}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Guided({
  city,
  results,
  rels,
  board,
  reading,
}: {
  city: string;
  results: TestResult[];
  rels: ModuleRelevance[];
  board: React.ReactNode;
  reading: React.ReactNode;
}) {
  const n = results.length + 2;
  const [active, setActive] = useState(0);
  const steps = useRef<(HTMLDivElement | null)[]>([]);
  const narrow = useMediaQuery(NARROW_QUERY);
  /* the reading line: the scroller's middle on a wide screen; stacked, just
     under the pinned stage, where a step's title arrives (the steps are
     top-aligned there, see the 920px rules) */
  useEffect(() => {
    const els = steps.current.filter(Boolean) as HTMLDivElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(els.indexOf(e.target as HTMLDivElement));
        }),
      {
        root: els[0].closest(".pages"),
        rootMargin: narrow ? "-64% 0px -35% 0px" : "-50% 0px -49% 0px",
      },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [narrow, n]);

  const testAt = active >= 1 && active <= results.length ? active - 1 : null;
  const final = active === n - 1;
  const current = testAt != null ? results[testAt] : null;
  /* how many tests the tally has read: every one before the stop, and the
     stop's own */
  const upTo = final ? results.length : testAt != null ? testAt + 1 : 0;
  const suggested = rels.filter((r) => r.suggested);

  return (
    <>
      <div className="od-scrolly" id="page-constraints">
        <div className="ct-steps od-steps">
          {Array.from({ length: n }, (_, i) => {
            const r = i >= 1 && i <= results.length ? results[i - 1] : null;
            return (
              <div
                key={i}
                ref={(el) => {
                  steps.current[i] = el;
                }}
                className={"ct-step od-step" + (i === active ? " is-on" : "")}
                aria-current={i === active ? "step" : undefined}
              >
                <div className="ct-eyebrow">
                  Constraints Diagnosis{" "}
                  <b className="ct-count">
                    {i + 1}/{n}
                  </b>
                </div>
                {i === 0 ? (
                  <>
                    <h2 className="od-part">The Tests</h2>
                    <p className="lede">
                      <span className="ph">
                        [placeholder: several tests read the city&rsquo;s data. each
                        points to the data modules worth a look]
                      </span>
                    </p>
                  </>
                ) : r ? (
                  <>
                    <h2>{r.test.title}</h2>
                    <GeoBadge geo={r.test.level === "msa" ? "metro" : "city"} cityShort={city} />
                    <p className="lede">
                      <span className="ph">[placeholder: what this test compares, and how it reads]</span>
                    </p>
                    <Outcome r={r} />
                    <PointsTo r={r} />
                  </>
                ) : (
                  <>
                    <h2 className="od-part">Suggested Modules</h2>
                    <p className="lede">
                      <span className="ph">
                        [placeholder: the modules the most tests point to. any module
                        can be added below]
                      </span>
                    </p>
                    <ModuleChips modules={suggested.map((s) => s.module)} color={MOD_COLOR} />
                    <button
                      type="button"
                      className="od-next"
                      onClick={() => scrollToId("page-constraints-diagnose")}
                    >
                      Choose what to read <span aria-hidden="true">↓</span>
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="od-stagewrap">
          <div className="od-stage">
            <div className={"od-stage-inst" + (final ? " gone" : "")}>
              {/* the intro's line-up: the tests, before any is read */}
              <ol className={"od-lineup" + (active === 0 ? " on" : "")} aria-hidden={active !== 0}>
                {results.map((r) => (
                  <li key={r.test.id}>
                    <i style={{ background: r.status === "live" ? r.color : undefined }} />
                    <b>{r.test.title}</b>
                    <span>{r.test.compares}</span>
                  </li>
                ))}
              </ol>
              {results.map((r, i) => (
                <div
                  key={r.test.id}
                  className={"od-inst" + (i === testAt ? " on" : "")}
                  aria-hidden={i !== testAt}
                >
                  <TestChart id={r.test.id} city={city} />
                  {r.status === "tocome" && <span className="ba-step-tag">Placeholder</span>}
                </div>
              ))}
            </div>
            <div className="od-tally-k">
              {final ? (
                <>
                  Ranked by the Tests <span>{suggested.length} suggested</span>
                </>
              ) : (
                <>
                  Data Modules{" "}
                  <span>
                    {upTo} of {results.length} tests read
                  </span>
                </>
              )}
            </div>
            <Tally rels={rels} results={results} upTo={upTo} current={current} final={final} />
          </div>
        </div>
      </div>
      <section className="page od-page" id="page-constraints-diagnose">
        <BlockHead title="Choose What to Read" />
        {board}
      </section>
      <section className="page od-page" id="page-branch-analysis">
        <BlockHead title="Your Reading List" />
        {reading}
      </section>
    </>
  );
}

/* ---------- bench: every test at once ---------- */

function Bench({
  city,
  results,
  hot,
  onHover,
  board,
  reading,
}: {
  city: string;
  results: TestResult[];
  hot: Hot;
  onHover: (h: Hot) => void;
  board: React.ReactNode;
  reading: React.ReactNode;
}) {
  return (
    <>
      <section className="page od-page" id="page-constraints">
        <SectionHead />
        <BlockHead
          title="Tests"
          aside={`${liveCount(results)} of ${results.length} with data for ${city}`}
        />
        <div className="od-tests">
          {results.map((r) => (
            <TestCard key={r.test.id} r={r} city={city} hot={hot} onHover={onHover} />
          ))}
        </div>
      </section>
      <section className="page od-page" id="page-constraints-diagnose">
        <BlockHead title="Data Modules" />
        <p className="lede od-sub">
          <span className="ph">
            [placeholder: the modules the tests point to are suggested. add or remove any]
          </span>
        </p>
        {board}
      </section>
      <section className="page od-page" id="page-branch-analysis">
        <BlockHead title="Your Reading List" />
        {reading}
      </section>
    </>
  );
}

/* ---------- explorer: the modules first ---------- */

function Explorer({
  city,
  results,
  rels,
  hot,
  onHover,
}: {
  city: string;
  results: TestResult[];
  rels: ModuleRelevance[];
  hot: Hot;
  onHover: (h: Hot) => void;
}) {
  const [openTest, setOpenTest] = useState<TestId | null>(null);
  const [openId, setOpenId] = useState(rels[0].module.id);
  /* a new city re-ranks the list: open its top suggestion */
  useEffect(() => {
    setOpenId(rels[0].module.id);
    setOpenTest(null);
  }, [rels]);
  const mainRef = useRef<HTMLDivElement>(null);
  const open = rels.find((r) => r.module.id === openId) ?? rels[0];
  const at = rels.indexOf(open);
  /* opening a module brings its top into view when it is not: above, on a
     long module; below, where the list stacks over it */
  const go = (id: string) => {
    setOpenId(id);
    const top = mainRef.current?.getBoundingClientRect().top;
    if (top != null && (top < 80 || top > window.innerHeight * 0.6))
      mainRef.current!.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const suggested = rels.filter((r) => r.suggested);
  const test = results.find((r) => r.test.id === openTest);

  return (
    <>
      <section className="page od-page" id="page-constraints">
        <SectionHead />
        <div className="od-strip" id="page-constraints-diagnose">
          <span className="od-strip-k">Tests</span>
          {results.map((r) => (
            <button
              key={r.test.id}
              type="button"
              className={
                "od-tchip" +
                (r.test.id === openTest ? " open" : "") +
                (r.status === "live" ? "" : " quiet") +
                testState(hot, r)
              }
              aria-expanded={r.test.id === openTest}
              onClick={() => setOpenTest((t) => (t === r.test.id ? null : r.test.id))}
              onPointerEnter={() => onHover({ test: r.test.id })}
              onPointerLeave={() => onHover(null)}
            >
              <i style={{ background: r.status === "live" ? r.color : undefined }} />
              <span className="od-tchip-txt">
                <b>{r.test.title}</b>
                <span>{titleCase(r.outcome)}</span>
              </span>
              <svg viewBox="0 0 10 6" aria-hidden="true">
                <path d="M1 1.5 5 4.8 9 1.5" />
              </svg>
            </button>
          ))}
        </div>
        {test && (
          <div className="od-drawer">
            <TestCard r={test} city={city} />
          </div>
        )}
      </section>
      <section className="page od-page od-xbody" id="page-branch-analysis">
        <aside className="od-xlist">
          {[
            { k: `Suggested for ${city}`, rels: suggested },
            { k: "Other Modules", rels: rels.filter((r) => !r.suggested) },
          ].map((g) => (
            <Fragment key={g.k}>
              <div className="od-board-k">
                {g.k} <span>{g.rels.length}</span>
              </div>
              <ul>
                {g.rels.map((rel) => {
                  const id = rel.module.id;
                  const on = id === open.module.id;
                  return (
                    <li key={id} className={moduleState(hot, id, results).trim()}>
                      <button
                        type="button"
                        className={"od-xrow" + (on ? " on" : "") + (rel.suggested ? " sugg" : "")}
                        aria-current={on ? "true" : undefined}
                        onClick={() => go(id)}
                        onPointerEnter={() => onHover({ module: id })}
                        onPointerLeave={() => onHover(null)}
                      >
                        <span className="od-mod-ico" aria-hidden="true">
                          <NodeGlyph id={id} />
                        </span>
                        <span className="od-xrow-txt">
                          <b>{rel.module.title}</b>
                          <span>{whyLine(rel)}</span>
                        </span>
                        <Pips id={id} results={results} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Fragment>
          ))}
        </aside>
        <div className="od-xmain" ref={mainRef}>
          <p className="od-xwhy">
            <Pips id={open.module.id} results={results} />
            {open.suggested ? (
              <span>
                <b>Suggested</b> · {whyLine(open)}
              </span>
            ) : (
              <span>
                <b>Not suggested</b> · {whyLine(open)}
              </span>
            )}
          </p>
          <div className="ba-ending ba-lay-float ba-full od-reading">
            <div className="ba-modules">
              <ModuleBlock def={open.module} color={MOD_COLOR} cityShort={city} />
            </div>
          </div>
          <div className="od-xnav">
            {at > 0 ? (
              <button type="button" className="od-xnav-btn" onClick={() => go(rels[at - 1].module.id)}>
                <span>Previous</span>
                <b>← {rels[at - 1].module.title}</b>
              </button>
            ) : (
              <span />
            )}
            {at < rels.length - 1 && (
              <button type="button" className="od-xnav-btn next" onClick={() => go(rels[at + 1].module.id)}>
                <span>Next</span>
                <b>{rels[at + 1].module.title} →</b>
              </button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------- the section ---------- */

export function OpenDiagnosis({
  variant,
  cityShort,
  country,
}: {
  variant: OpenVariant;
  cityShort: string;
  country: string;
}) {
  const results = useMemo(() => runTests(cityShort, country), [cityShort, country]);
  const rels = useMemo(() => rankModules(results), [results]);
  const suggestedIds = useMemo(
    () => new Set(rels.filter((r) => r.suggested).map((r) => r.module.id)),
    [rels],
  );
  /* the reading list: the suggestions until the reader changes it, and
     again with every new city */
  const [picked, setPicked] = useState<ReadonlySet<string>>(suggestedIds);
  useEffect(() => setPicked(suggestedIds), [suggestedIds]);
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [hot, setHot] = useState<Hot>(null);

  const board = (
    <ModuleBoard
      city={cityShort}
      rels={rels}
      results={results}
      picked={picked}
      onToggle={toggle}
      onReset={() => setPicked(suggestedIds)}
      hot={hot}
      onHover={setHot}
    />
  );
  const reading = <ReadingList city={cityShort} rels={rels} picked={picked} />;

  return (
    <div className={"od od-" + variant}>
      {variant === "guided" ? (
        <Guided city={cityShort} results={results} rels={rels} board={board} reading={reading} />
      ) : variant === "bench" ? (
        <Bench
          city={cityShort}
          results={results}
          hot={hot}
          onHover={setHot}
          board={board}
          reading={reading}
        />
      ) : (
        <Explorer city={cityShort} results={results} rels={rels} hot={hot} onHover={setHot} />
      )}
    </div>
  );
}
