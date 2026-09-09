import { memo } from "react";
import body from "./html/body.html?raw";

/** v-3's whole <body>: landing, tool (masthead, section tabs, pages, pager),
 *  explainers view and dialogs. Mounted once and then owned by v-3's own
 *  scripts: React sets the HTML on mount and never touches the subtree
 *  again (the string is a constant, so it never re-sets innerHTML) — the
 *  two places React draws are portals into slots inside it (App.tsx). The
 *  wrapper contributes no box of its own (port.css). */
export const LegacyShell = memo(function LegacyShell() {
  return <div className="v3-shell" dangerouslySetInnerHTML={{ __html: body }} />;
});
