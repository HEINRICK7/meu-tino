import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import "./styles/tokens.css";
import "./styles/global.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch((error: unknown) => {
        console.warn(
          "Meu TINO: não foi possível registrar o Service Worker",
          error,
        );
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
