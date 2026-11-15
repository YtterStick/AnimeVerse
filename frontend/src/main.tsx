import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
import { TitleLanguageProvider } from "./contexts/TitleLanguageContext";
import { ToastProvider } from "./contexts/ToastContext";
import { LayoutProvider } from "./contexts/LayoutContext";
import { App } from "./App";
import "./index.css";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            reg.update().catch(() => {});
          }
        });
      })
      .catch(() => {});
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <TitleLanguageProvider>
        <ToastProvider>
          <LayoutProvider>
            <App />
          </LayoutProvider>
        </ToastProvider>
      </TitleLanguageProvider>
    </AuthProvider>
  </StrictMode>
);
