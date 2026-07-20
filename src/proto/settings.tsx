/**
 * Prototype settings — one master switch for the learning layer, in a gear
 * drawer. When on, every story section down to the levers opens with a
 * prior-check quiz, except two that swap the card for a hands-on instrument
 * (drag-the-metro on the performance screen, the decision-tree walk on the
 * housing test); a scorecard closes the story. localStorage-backed; the story
 * renders clean when off.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useJourney } from "../state/journey";

export type ProtoId = "quizzes";

interface Element {
  id: ProtoId;
  name: string;
  desc: string;
}

export const ELEMENTS: Element[] = [
  {
    id: "quizzes",
    name: "Quizzes & instruments",
    desc: "Every section down to the levers opens with a “check your intuition” card graded against the numbers — most are multiple choice; two are hands-on (drag the metro onto the plane, walk the diagnostic tree). A scorecard closes the story.",
  },
];

type EnabledMap = Record<ProtoId, boolean>;
const ALL_OFF: EnabledMap = { quizzes: false };
/** Fresh visitors start with the learning layer on. */
const DEFAULTS: EnabledMap = { quizzes: true };

interface ProtoCtx {
  enabled: EnabledMap;
  on: (id: ProtoId) => boolean;
  toggle: (id: ProtoId) => void;
  setAll: (v: boolean) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  activeCount: number;
}

const Ctx = createContext<ProtoCtx | null>(null);
const KEY = "gd-proto-settings:boston-ma-v3";

function load(): EnabledMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...ALL_OFF, ...(JSON.parse(raw) as Partial<EnabledMap>) };
  } catch {
    /* fresh */
  }
  return DEFAULTS;
}

export function PrototypeSettingsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<EnabledMap>(load);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(enabled));
    } catch {
      /* session-only */
    }
  }, [enabled]);

  const toggle = useCallback((id: ProtoId) => setEnabled((e) => ({ ...e, [id]: !e[id] })), []);
  const setAll = useCallback((v: boolean) => setEnabled({ quizzes: v }), []);
  const on = useCallback((id: ProtoId) => !!enabled[id], [enabled]);
  const activeCount = useMemo(() => Object.values(enabled).filter(Boolean).length, [enabled]);

  const value = useMemo(
    () => ({ enabled, on, toggle, setAll, open, setOpen, activeCount }),
    [enabled, on, toggle, setAll, open, activeCount],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProto(): ProtoCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProto outside PrototypeSettingsProvider");
  return ctx;
}

/* ————— the gear drawer ————— */

export function PrototypeDrawer() {
  const { enabled, toggle, setAll, open, setOpen } = useProto();
  const { learningMode, setLearningMode, answers, resetAnswers } = useJourney();
  const answeredCount = Object.keys(answers).length;
  if (!open) return null;

  return (
    <>
      <div className="proto-scrim" onClick={() => setOpen(false)} />
      <aside className="proto-drawer" role="dialog" aria-label="Prototype settings">
        <div className="drawer-head">
          <h3>Prototype settings</h3>
          <button className="close" aria-label="Close" onClick={() => setOpen(false)}>
            ×
          </button>
        </div>
        <div className="drawer-body">
          <p className="proto-intro">
            The story below is the plain Growth-Lab city diagnosis. Switch this on to layer in the
            sandbox's experimental quizzes and instruments.
          </p>

          {ELEMENTS.map((e) => (
            <label className={`toggle-row ${enabled[e.id] ? "on" : ""}`} key={e.id}>
              <span className={`switch ${enabled[e.id] ? "on" : ""}`} />
              <input type="checkbox" hidden checked={enabled[e.id]} onChange={() => toggle(e.id)} />
              <span className="t-copy">
                <span className="t-name">{e.name}</span>
                <span className="t-desc">{e.desc}</span>
              </span>
            </label>
          ))}

          <div className="proto-group">
            <div className="group-title">Quiz behaviour</div>
            {/* Learning mode only means something while quizzes exist — with
                the element off it is inert, so it reads (and is) disabled. */}
            <label
              className={`toggle-row ${learningMode ? "on" : ""} ${enabled.quizzes ? "" : "is-disabled"}`}
            >
              <span className={`switch master ${learningMode ? "on" : ""}`} />
              <input
                type="checkbox"
                hidden
                checked={learningMode}
                disabled={!enabled.quizzes}
                onChange={(e) => setLearningMode(e.target.checked)}
              />
              <span className="t-copy">
                <span className="t-name">Learning mode</span>
                <span className="t-desc">When on, a quiz blurs its section until you answer or skip.</span>
              </span>
            </label>
          </div>
        </div>
        <div className="drawer-foot">
          <button onClick={() => resetAnswers()} disabled={answeredCount === 0}>
            reset quiz answers{answeredCount > 0 ? ` (${answeredCount})` : ""}
          </button>
          {" · "}
          <button onClick={() => setAll(false)}>reset the page</button>
        </div>
      </aside>
    </>
  );
}
