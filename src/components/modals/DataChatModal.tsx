import { useEffect, useRef, useState } from "react";
import { CHAT_SUGGESTIONS } from "../../data/content";
import { downloadChatCsv } from "../../lib/downloads";
import { CloseIcon, DownloadIcon } from "../icons";

interface ChatMsg {
  role: "bot" | "user";
  text: string;
  /** the user question a bot reply answers; enables its CSV download */
  query?: string;
}

interface DataChatModalProps {
  open: boolean;
  onClose: () => void;
}

/** Experimental data-inquiry window. Replies are canned; message history
 *  survives closing and reopening the window. */
export function DataChatModal({ open, onClose }: DataChatModalProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [messages]);

  const send = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    window.setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: `I put together a sample extract for “${q}”. In the full tool this will query the Cities database directly.`,
          query: q,
        },
      ]);
    }, 550);
  };

  return (
    <div
      className={"journey-overlay" + (open ? " open" : "")}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="chat-window" role="dialog" aria-modal="true" aria-labelledby="chatTitle">
        <div className="journey-head">
          <div className="jh-icon">
            <svg
              width="20"
              height="19"
              viewBox="0 0 18 17"
              fill="none"
              stroke="#255862"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1.5 3.5A2 2 0 0 1 3.5 1.5h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6.5L2.8 15.6a.8.8 0 0 1-1.3-.6V3.5Z" />
              <path d="M5.5 5.8h7M5.5 8.4h4.5" />
            </svg>
          </div>
          <div className="jh-titles">
            <h2 id="chatTitle">
              Data Chat <span className="beta-tag">beta</span>
            </h2>
          </div>
          <button className="journey-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="chat-body" ref={bodyRef}>
          <div className="chat-msg bot">
            This is an experimental data inquiry window. Ask a question about the data behind the
            charts, and I can prepare the answer as a CSV for you to download.
          </div>
          {messages.length === 0 && (
            <div className="chat-suggest">
              {CHAT_SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={"chat-msg " + msg.role}>
              {msg.text}
              {msg.query !== undefined && (
                <>
                  <br />
                  <button className="csv-btn" onClick={() => downloadChatCsv(msg.query!)}>
                    <DownloadIcon />
                    Download CSV
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="chat-foot">
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask about the data.."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <button className="chat-send" onClick={() => send()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
