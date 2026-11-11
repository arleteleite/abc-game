import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiClient } from "./api/ApiClient";
import { HomeScreen } from "./screens/HomeScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { MatchScreen } from "./screens/MatchScreen";
import { SessionStore, type Session } from "./session/SessionStore";

type Screen = { name: "loading" } | { name: "home" } | { name: "lobby" } | { name: "match"; matchId: string };

// Sem biblioteca de rotas: a tela atual é só um valor guardado em estado.
export function App() {
  const [session, setSession] = useState<Session | null>(() => SessionStore.load());
  const [screen, setScreen] = useState<Screen>(() => (SessionStore.load() ? { name: "loading" } : { name: "home" }));

  const tokenRef = useRef<string | null>(session?.token ?? null);
  tokenRef.current = session?.token ?? null;
  const api = useMemo(() => new ApiClient(() => tokenRef.current), []);

  const dropSession = useCallback(() => {
    SessionStore.clear();
    setSession(null);
    setScreen({ name: "home" });
  }, []);

  // Se havia uma sessão salva, confere com o servidor e retoma (inclusive uma partida em andamento).
  useEffect(() => {
    if (screen.name !== "loading") return;
    api
      .lobby()
      .then((view) => setScreen(view.matchId ? { name: "match", matchId: view.matchId } : { name: "lobby" }))
      .catch(dropSession);
  }, [screen.name, api, dropSession]);

  const goMatch = useCallback((matchId: string) => setScreen({ name: "match", matchId }), []);

  if (screen.name === "loading") return <main className="screen"><p className="hint center">Carregando…</p></main>;

  if (screen.name === "home" || !session) {
    return (
      <HomeScreen
        api={api}
        onJoined={(joined) => {
          SessionStore.save(joined);
          tokenRef.current = joined.token;
          setSession(joined);
          setScreen({ name: "lobby" });
        }}
      />
    );
  }

  if (screen.name === "match") {
    return <MatchScreen matchId={screen.matchId} token={session.token} onExit={() => setScreen({ name: "lobby" })} />;
  }

  return <LobbyScreen api={api} session={session} onMatch={goMatch} onLeave={dropSession} onSessionLost={dropSession} />;
}
