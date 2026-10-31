import { MotionConfig } from "framer-motion";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import { ToastProvider } from "./components/ui";
import "./index.css";
import { I18nProvider } from "./lib/i18n";

// When a new version of the site takes over, reload once so nobody stays on an old saved copy.
if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloading) { reloading = true; window.location.reload(); }
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <I18nProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </I18nProvider>
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
);
