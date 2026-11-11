import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Footer } from "./components/Footer";
import { TelaoPage } from "./screens/TelaoPage";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    {/* /telao: página só de leitura para o telão (sem login). */}
    {location.pathname.startsWith("/telao") ? <TelaoPage /> : <App />}
    <Footer />
  </StrictMode>,
);
