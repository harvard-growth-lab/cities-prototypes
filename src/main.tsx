import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/base.css";
import "./styles/landing.css";
import "./styles/tool.css";
import "./styles/intro.css";
import "./styles/explainers.css";
import "./styles/modals.css";
import "./styles/figures.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
