import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
/* v-3's own stylesheet is the app's (src/legacy); this branch's sheets
   follow it — the constraints figures and the explainers — and the port's
   few adjustments come last */
import "./legacy/v3.css";
import "./styles/figures.css";
import "./styles/explainers.css";
import "./legacy/port.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
