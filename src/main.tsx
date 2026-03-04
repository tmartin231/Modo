import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./i18n.ts";
import "./index.css";
import { Analytics } from "@vercel/analytics/next";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Analytics />
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
