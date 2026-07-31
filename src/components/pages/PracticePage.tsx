import { useRef, useState } from "react";
import { InsightIcon } from "../icons";

interface PracticePageProps {
  onSave: (text: string) => void;
}

/** "Put in Practice": a free-text reflection saved to the Learning Journey. */
export function PracticePage({ onSave }: PracticePageProps) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      areaRef.current?.focus();
      return;
    }
    onSave(trimmed);
    setSaved(true);
  };

  return (
    <section className="page" id="page-practice">
      <div className="page-head">
        <h2>Put in Practice</h2>
      </div>
      <div className="practice-card">
        <div className="practice-head">
          <span className="practice-badge">
            <InsightIcon stroke="#255862" strokeWidth={1.8} />
          </span>
          <h3>Put insights into action</h3>
        </div>
        <p className="prompt">
          Consider how your city’s economic structure creates opportunities and challenges.
        </p>
        <textarea
          ref={areaRef}
          placeholder="Write your reflections or notes.. "
          value={text}
          onChange={(e) => setText(e.target.value)}
        ></textarea>
        <div className="practice-actions">
          <button className="btn-save" onClick={submit}>
            Save my Response
          </button>
          <span className={"practice-confirm" + (saved ? " shown" : "")}>
            <svg viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#255862" strokeWidth="1.5" />
              <path d="M5 8.2 7.2 10.4 11 6" stroke="#255862" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Saved to your Learning Journey.
          </span>
        </div>
      </div>
    </section>
  );
}
