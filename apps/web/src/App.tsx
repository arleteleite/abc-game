import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiClient } from "./api/ApiClient";
import { readInviteId } from "./invite/inviteLink";
import { HomeScreen } from "./screens/HomeScreen";
import { InviteScreen } from "./screens/InviteScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { MatchScreen } from "./screens/MatchScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { QuizScreen } from "./screens/QuizScreen";
import { RankingScreen } from "./screens/RankingScreen";
import { SessionStore, type Session } from "./session/SessionStore";

type Screen =
  | { name: "loading" }
  | { name: "home" }
  | { name: "menu" }
  | { name: "quiz" }
  | { name: "ranking" }
  | { name: "invite"; invitationId: string }
  | { name: "lobby" }
  | { name: "match"; matchId: string };

// Convite por link: o id vem na URL (?convite=...). Guardo e limpo a URL na hora, para que
// recarregar a página ou compartilhar a tela não reaproveite o convite sem querer.
function takeInviteFromUrl(): string | null {
  const id = readInviteId(window.location.search);
  if (id) window.history.replaceState(null, "", window.location.pathname);
  return id;
}

// Lido uma única vez, quando o módulo carrega (se fosse dentro do componente, o modo estrito do
// React, que executa a inicialização duas vezes em desenvolvimento, perderia o convite).
const inviteFromUrl = takeInviteFromUrl();

// Sem biblioteca de rotas: a tela atual é só um valor guardado em estado.
export function App() {
  const [session, setSession] = useState<Session | null>(() => SessionStore.load());
  const [pendingInvite, setPendingInvite] = useState<string | null>(inviteFromUrl);
  const [screen, setScreen] = useState<Screen>(() => (SessionStore.load() ? { name: "loading" } : { name: "home" }));

  const tokenRef = useRef<string | null>(session?.token ?? null);
  tokenRef.current = session?.token ?? null;
  const api = useMemo(() => new ApiClient(() => tokenRef.current), []);

  // Sessão perdida (token inválido): volta ao início, mas não perde o convite pendente.
  const dropSession = useCallback(() => {
    SessionStore.clear();
    setSession(null);
    setScreen({ name: "home" });
  }, []);

  // Se havia uma sessão salva, confere com o servidor e retoma (partida em andamento, convite ou menu).
  useEffect(() => {
    if (screen.name !== "loading") return;
    api
      .lobby()
      .then((view) => {
        if (view.matchId) setScreen({ name: "match", matchId: view.matchId });
        else if (pendingInvite) setScreen({ name: "invite", invitationId: pendingInvite });
        else setScreen({ name: "menu" });
      })
      .catch(dropSession);
  }, [screen.name, api, dropSession, pendingInvite]);

  const goMatch = useCallback((matchId: string) => {
    setPendingInvite(null);
    setScreen({ name: "match", matchId });
  }, []);
  const goMenu = useCallback(() => {
    setPendingInvite(null);
    setScreen({ name: "menu" });
  }, []);

  if (screen.name === "loading") return <main className="screen"><p className="hint center">Carregando…</p></main>;

  if (screen.name === "home" || !session) {
    return (
      <HomeScreen
        api={api}
        invited={pendingInvite !== null}
        onJoined={(joined) => {
          SessionStore.save(joined);
          tokenRef.current = joined.token;
          setSession(joined);
          setScreen(pendingInvite ? { name: "invite", invitationId: pendingInvite } : { name: "menu" });
        }}
      />
    );
  }

  switch (screen.name) {
    case "menu":
      return (
        <MenuScreen
          api={api}
          session={session}
          onTrail={() => setScreen({ name: "lobby" })}
          onQuiz={() => setScreen({ name: "quiz" })}
          onRanking={() => setScreen({ name: "ranking" })}
          onLeave={dropSession}
          onSessionLost={dropSession}
        />
      );
    case "invite":
      return <InviteScreen api={api} invitationId={screen.invitationId} onMatch={goMatch} onDone={goMenu} onSessionLost={dropSession} />;
    case "ranking":
      return <RankingScreen onBack={goMenu} />;
    case "quiz":
      return <QuizScreen api={api} onExit={goMenu} onSessionLost={dropSession} />;
    case "match":
      return <MatchScreen matchId={screen.matchId} token={session.token} onExit={() => setScreen({ name: "lobby" })} />;
    case "lobby":
      return <LobbyScreen api={api} session={session} onMatch={goMatch} onMenu={goMenu} onLeave={dropSession} onSessionLost={dropSession} />;
  }
}
