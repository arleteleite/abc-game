import type { LobbyResponse } from "@abc-game/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, type ApiClient } from "../api/ApiClient";

interface LobbyState {
  view: LobbyResponse | null;
  /** Código do erro da última consulta (ex.: "network", "unauthorized"). */
  error: string | null;
}

// Consulta o saguão de tempos em tempos (só com a aba visível, para poupar a
// cota do servidor e a bateria). `refresh` consulta na hora.
export function useLobby(api: ApiClient, onUnauthorized: () => void): LobbyState & { refresh: () => void } {
  const [state, setState] = useState<LobbyState>({ view: null, error: null });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollSeconds = useRef(5);
  const alive = useRef(true);

  const poll = useCallback(async () => {
    try {
      const view = await api.lobby();
      pollSeconds.current = view.pollSeconds;
      if (alive.current) setState({ view, error: null });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized();
        return;
      }
      if (alive.current) setState((s) => ({ ...s, error: error instanceof ApiError ? error.code : "unknown" }));
    }
  }, [api, onUnauthorized]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (document.visibilityState === "visible") await poll();
      if (alive.current) schedule();
    }, pollSeconds.current * 1000);
  }, [poll]);

  useEffect(() => {
    alive.current = true;
    void poll().then(() => alive.current && schedule());
    const onVisible = () => document.visibilityState === "visible" && void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll, schedule]);

  return { ...state, refresh: () => void poll() };
}
