import type { Pawn } from "@abc-game/domain";
import type { InvitationView } from "@abc-game/domain";
import { useEffect, useState } from "react";
import { ApiError, type ApiClient } from "../api/ApiClient";
import { PawnImage } from "../components/PawnImage";
import { PawnPicker } from "../components/PawnPicker";
import { pawnLabel } from "../constants";
import { useLobby } from "../hooks/useLobby";
import { errorText } from "../messages";
import type { Session } from "../session/SessionStore";

interface Props {
  api: ApiClient;
  session: Session;
  onMatch: (matchId: string) => void;
  onLeave: () => void;
  onSessionLost: () => void;
}

// Saguão da Trilha: escolher o peão, ver quem está disponível, convidar e responder convites.
export function LobbyScreen({ api, session, onMatch, onLeave, onSessionLost }: Props) {
  const { view, error: pollError, refresh } = useLobby(api, onSessionLost);
  const [pawn, setPawn] = useState<Pawn | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Quando uma partida começa (alguém aceitou o meu convite), vai para ela.
  useEffect(() => {
    if (view?.matchId) onMatch(view.matchId);
  }, [view?.matchId, onMatch]);

  // Recusado, expirado ou cancelado: o servidor avisa uma única vez; guardo o aviso.
  useEffect(() => {
    const outgoing = view?.outgoing;
    if (!outgoing) return;
    if (outgoing.state === "declined") setNotice("O convite foi recusado.");
    if (outgoing.state === "expired") setNotice("O convite expirou sem resposta.");
  }, [view?.outgoing]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      refresh();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "unknown";
      if (code === "unauthorized") onSessionLost();
      setActionError(errorText(code));
      refresh();
    } finally {
      setBusy(false);
    }
  }

  const invite = (toPlayerId: string) => {
    if (!pawn) return;
    setNotice(null);
    void run(() => api.invite(toPlayerId, pawn));
  };

  const accept = (invitation: InvitationView, chosen: Pawn) => {
    void run(async () => {
      const { matchId } = await api.accept(invitation.id, chosen);
      onMatch(matchId);
    });
  };

  const waitingFor = view?.outgoing?.state === "created" ? view.outgoing : null;
  const waitingNickname = waitingFor ? (view?.available.find((p) => p.id === waitingFor.toPlayerId)?.nickname ?? "o jogador") : null;

  return (
    <main className="screen lobby">
      <header className="topbar">
        <span>
          Olá, <strong>{session.player.nickname}</strong>
        </span>
        <button
          className="button small"
          onClick={() => {
            void api.leave().catch(() => undefined);
            onLeave();
          }}
        >
          Sair
        </button>
      </header>

      {(actionError || pollError) && (
        <p className="error" role="alert">
          <span aria-hidden="true">⚠ </span>
          {actionError ?? errorText(pollError ?? "unknown")}
        </p>
      )}
      {notice && <p className="notice">{notice}</p>}

      <section className="card">
        <h2>1. Seu peão (para desafiar)</h2>
        <PawnPicker selected={pawn} onSelect={setPawn} />
      </section>

      {view && view.incoming.length > 0 && (
        <section className="card highlight">
          <h2>Você foi desafiado!</h2>
          {view.incoming.map((invitation) => (
            <IncomingInvitation key={invitation.id} invitation={invitation} busy={busy} onAccept={accept} onDecline={() => void run(() => api.decline(invitation.id))} />
          ))}
        </section>
      )}

      {waitingFor && (
        <section className="card">
          <h2>Convite enviado</h2>
          <p>
            Aguardando <strong>{waitingNickname}</strong> responder (o convite vale por 3 minutos)…
          </p>
          <button className="button" disabled={busy} onClick={() => void run(() => api.cancel(waitingFor.id))}>
            Cancelar convite
          </button>
        </section>
      )}

      <section className="card">
        <h2>2. Quem está disponível</h2>
        {!view && <p className="hint">Carregando…</p>}
        {view && view.available.length === 0 && <p className="hint">Ninguém disponível agora. Peça a um colega para entrar.</p>}
        <ul className="player-list">
          {view?.available.map((player) => (
            <li key={player.id} className="player-row">
              <span className="player-name">{player.nickname}</span>
              <button className="button primary small" disabled={!pawn || busy || waitingFor !== null} onClick={() => invite(player.id)}>
                Desafiar
              </button>
            </li>
          ))}
        </ul>
        {!pawn && view && view.available.length > 0 && <p className="hint">Escolha seu peão para poder desafiar.</p>}
      </section>
    </main>
  );
}

function IncomingInvitation({
  invitation,
  busy,
  onAccept,
  onDecline,
}: {
  invitation: InvitationView;
  busy: boolean;
  onAccept: (invitation: InvitationView, pawn: Pawn) => void;
  onDecline: () => void;
}) {
  const [pawn, setPawn] = useState<Pawn | null>(null);
  return (
    <div className="incoming">
      <p>
        <strong>{invitation.fromNickname}</strong> quer jogar com o peão{" "}
        <span className="inline-pawn">
          <PawnImage pawn={invitation.fromPawn} size={28} /> {pawnLabel(invitation.fromPawn)}
        </span>
        . Escolha o seu:
      </p>
      <PawnPicker selected={pawn} disabled={invitation.fromPawn} onSelect={setPawn} />
      <div className="row">
        <button className="button primary" disabled={!pawn || busy} onClick={() => pawn && onAccept(invitation, pawn)}>
          Aceitar
        </button>
        <button className="button" disabled={busy} onClick={onDecline}>
          Recusar
        </button>
      </div>
    </div>
  );
}
