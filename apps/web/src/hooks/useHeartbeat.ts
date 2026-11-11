import { useEffect } from "react";
import type { ApiClient } from "../api/ApiClient";

const EVERY_MS = 20_000;

// Avisa o servidor que o jogador continua por aqui (no menu e no Quiz, onde não há
// outra consulta periódica). Sem sinal por 2 minutos, a sessão acaba. Só com a aba visível.
export function useHeartbeat(api: ApiClient, onUnauthorized: () => void): void {
  useEffect(() => {
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      api.heartbeat().catch((error: unknown) => {
        if (error && typeof error === "object" && "status" in error && (error as { status: number }).status === 401) onUnauthorized();
      });
    };
    beat();
    const timer = setInterval(beat, EVERY_MS);
    const onVisible = () => beat();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [api, onUnauthorized]);
}
