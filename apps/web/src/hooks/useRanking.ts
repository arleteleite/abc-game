import type { RankingResponse } from "@abc-game/protocol";
import { useEffect, useRef, useState } from "react";

interface RankingState {
  data: RankingResponse | null;
  /** A última consulta falhou (os dados mostrados são os da última que deu certo). */
  offline: boolean;
}

// Consulta o ranking público de tempos em tempos (no app, só com a aba visível; o telão
// consulta sempre). Se a rede cair, continua mostrando o último ranking recebido.
export function useRanking(mode: "app" | "telao"): RankingState {
  const [state, setState] = useState<RankingState>({ data: null, offline: false });
  const interval = useRef(mode === "telao" ? 10 : 15);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        const response = await fetch("/api/ranking");
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as RankingResponse;
        interval.current = mode === "telao" ? data.telaoPollSeconds : data.pollSeconds;
        if (alive) setState({ data, offline: false });
      } catch {
        if (alive) setState((s) => ({ ...s, offline: true }));
      }
    };

    const loop = async () => {
      if (document.visibilityState === "visible" || mode === "telao") await load();
      if (alive) timer = setTimeout(() => void loop(), interval.current * 1000);
    };
    void loop();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [mode]);

  return state;
}
