import type { InvitationView, Pawn } from "@abc-game/domain";
import { useEffect, useState } from "react";
import { ApiError, type ApiClient } from "../api/ApiClient";
import { PawnImage } from "../components/PawnImage";
import { PawnPicker } from "../components/PawnPicker";
import { pawnLabel } from "../constants";
import { errorText } from "../messages";

interface Props {
  api: ApiClient;
  invitationId: string;
  onMatch: (matchId: string) => void;
  /** Sair desta tela sem aceitar (volta ao menu). */
  onDone: () => void;
  onSessionLost: () => void;
}

// Tela de quem abriu o link de convite: mostra quem convidou e deixa escolher o peão e aceitar.
export function InviteScreen({ api, invitationId, onMatch, onDone, onSessionLost }: Props) {
  const [invitation, setInvitation] = useState<InvitationView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pawn, setPawn] = useState<Pawn | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .invitationInfo(invitationId)
      .then(setInvitation)
      .catch((error: unknown) => {
        const code = error instanceof ApiError ? error.code : "unknown";
        if (code === "unauthorized") onSessionLost();
        setProblem(code);
      });
  }, [api, invitationId, onSessionLost]);

  async function accept() {
    if (!pawn) return;
    setBusy(true);
    setProblem(null);
    try {
      const { matchId } = await api.accept(invitationId, pawn);
      onMatch(matchId);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "unknown";
      if (code === "unauthorized") onSessionLost();
      setProblem(code);
      // Atualiza os dados do convite (pode ter sido usado ou expirado agora).
      api.invitationInfo(invitationId).then(setInvitation).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  const usable = invitation?.state === "created";

  return (
    <main className="screen">
      <h1 className="title">Convite para a Trilha ABC+</h1>

      {!invitation && !problem && <p className="hint center">Abrindo o convite…</p>}

      {invitation && (
        <section className="card">
          <p>
            <strong>{invitation.fromNickname}</strong> te desafiou para jogar com o peão{" "}
            <span className="inline-pawn">
              <PawnImage pawn={invitation.fromPawn} size={28} /> {pawnLabel(invitation.fromPawn)}
            </span>
            .
          </p>
          {usable ? (
            <>
              <h2>Escolha o seu peão</h2>
              <PawnPicker selected={pawn} disabled={invitation.fromPawn} onSelect={setPawn} />
              <button className="button primary" disabled={!pawn || busy} onClick={() => void accept()}>
                {busy ? "Entrando…" : "Aceitar o desafio"}
              </button>
            </>
          ) : (
            <p className="notice">
              {invitation.state === "expired" ? "Este convite expirou (vale por 3 minutos)." : "Este convite já foi usado ou cancelado."}
            </p>
          )}
        </section>
      )}

      {problem && (
        <p className="error" role="alert">
          <span aria-hidden="true">⚠ </span>
          {errorText(problem)}
        </p>
      )}

      <button className="button" onClick={onDone}>
        {usable ? "Agora não" : "Ir para o menu"}
      </button>
    </main>
  );
}
