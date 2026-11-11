import type { FinalPlayerStats, PlayerInfo } from "@abc-game/protocol";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { BoardView } from "../components/BoardView";
import { Countdown } from "../components/Countdown";
import { PawnImage } from "../components/PawnImage";
import { QuestionCard } from "../components/QuestionCard";
import { useMatch } from "../hooks/useMatch";
import type { Feedback, MatchViewState } from "../state/matchReducer";

interface Props {
  matchId: string;
  token: string;
  onExit: () => void;
  /** Revanche combinada pelos dois: ir para a partida nova. */
  onRematch: (matchId: string) => void;
}

const ANSWER_MS = 15_000; // só para a barra; o servidor é quem decide o estouro

export function MatchScreen({ matchId, token, onExit, onRematch }: Props) {
  const { state, answer, leave, requestRematch, declineRematch } = useMatch(matchId, token);

  // Os dois aceitaram a revanche: segue para a partida nova.
  useEffect(() => {
    if (state.nextMatchId) onRematch(state.nextMatchId);
  }, [state.nextMatchId, onRematch]);

  const confirmLeave = () => {
    if (window.confirm("Sair da partida? Ela termina sem vencedor.")) {
      leave();
      onExit();
    }
  };

  return (
    <main className="screen match">
      <ConnectionBanner state={state} />

      {state.you && state.opponent && state.phase !== "ended" && (
        <Scoreboard you={state.you} opponent={state.opponent} currentPlayerId={state.currentPlayerId} />
      )}

      {state.phase === "connecting" && <p className="hint center">Conectando à partida…</p>}

      {state.phase === "waiting" && (
        <section className="card center">
          <h2>Aguardando o adversário entrar…</h2>
          {state.opponent && (
            <p>
              <PawnImage pawn={state.opponent.pawn} size={64} />
              <br />
              {state.opponent.nickname}
            </p>
          )}
        </section>
      )}

      {state.phase === "race" && state.question && (
        <section>
          <h2 className="phase-title">Largada! Quem acertar mais rápido começa.</h2>
          <Countdown deadlineAt={state.deadlineAt} totalMs={ANSWER_MS} />
          <QuestionCard question={state.question} selected={state.selected} onChoose={answer} />
        </section>
      )}

      {state.phase === "race" && !state.question && <p className="hint center">Aguardando a próxima pergunta da largada…</p>}

      {state.phase === "playing" && state.you && state.opponent && (
        <>
          <FeedbackBanner feedback={state.feedback} state={state} />
          <BoardView boardSize={state.boardSize} players={state.players} you={state.you} opponent={state.opponent} currentPlayerId={state.currentPlayerId} compact={!!state.question} />
          {state.question ? (
            <section>
              <h2 className="phase-title">Sua vez!</h2>
              <Countdown deadlineAt={state.deadlineAt} totalMs={ANSWER_MS} />
              <QuestionCard question={state.question} selected={state.selected} onChoose={answer} />
            </section>
          ) : (
            <section className="card center">
              <h2>Vez de {state.currentPlayerId === state.opponent.id ? state.opponent.nickname : "…"}</h2>
              <Countdown deadlineAt={state.opponentDeadlineAt} totalMs={ANSWER_MS} />
              <p className="hint">Aguarde: a pergunta aparece só para quem está jogando.</p>
            </section>
          )}
          <button className="button small leave" onClick={confirmLeave}>
            Sair da partida
          </button>
        </>
      )}

      {state.phase === "ended" && (
        <ResultCard state={state} onExit={onExit} onRequestRematch={requestRematch} onDeclineRematch={declineRematch} />
      )}
    </main>
  );
}

function ConnectionBanner({ state }: { state: MatchViewState }) {
  if (state.phase === "ended") return null;
  if (state.connection === "reconnecting") {
    return <p className="banner warn" role="status">⚠ Reconectando… se o sinal voltar em até 30 s, a partida continua.</p>;
  }
  if (state.connection === "closed" && state.phase !== "connecting") {
    return <p className="banner warn" role="alert">⚠ Conexão encerrada. Volte ao saguão.</p>;
  }
  if (!state.opponentConnected) {
    return <p className="banner warn" role="status">⚠ O adversário caiu. Aguardando até 30 s…</p>;
  }
  return null;
}

function Scoreboard({ you, opponent, currentPlayerId }: { you: PlayerInfo; opponent: PlayerInfo; currentPlayerId: string | null }) {
  const row = (p: PlayerInfo, label: string) => (
    <div className={`score ${currentPlayerId === p.id ? "turn" : ""}`}>
      <PawnImage pawn={p.pawn} size={40} />
      <span>
        {label}
        <br />
        <strong>{p.nickname}</strong>
      </span>
    </div>
  );
  return (
    <div className="scoreboard">
      {row(you, "Você")}
      {row(opponent, "Adversário")}
    </div>
  );
}

function FeedbackBanner({ feedback, state }: { feedback: Feedback | null; state: MatchViewState }) {
  const text = useMemo(() => {
    if (!feedback || !state.you || !state.opponent) return null;
    const mine = feedback.playerId === state.you.id;
    const who = mine ? "Você" : state.opponent.nickname;
    const lines: string[] = [];
    if (feedback.correct) {
      lines.push(`${who} acertou!${feedback.move ? ` Avançou ${feedback.move.answerAdvance} casa(s).` : ""}`);
      if (feedback.move?.event) lines.push(`Casa de evento: ${feedback.move.event.label}.`);
    } else {
      lines.push(feedback.timedOut ? `${who}: tempo esgotado.` : `${who} errou.`);
      lines.push(`A resposta certa era a alternativa ${feedback.correctKey}.`);
    }
    for (const id of feedback.skippedPlayerIds) {
      lines.push(id === state.you.id ? "Você está parado e perdeu a vez." : `${state.opponent.nickname} está parado e perdeu a vez.`);
    }
    return lines;
  }, [feedback, state.you, state.opponent]);

  if (!feedback || !text) return null;
  const good = feedback.correct;
  return (
    <div className={`banner ${good ? "good" : "bad"}`} role="status">
      <span aria-hidden="true">{good ? "✔ " : "✖ "}</span>
      {text.map((line) => (
        <span key={line} className="banner-line">{line}</span>
      ))}
    </div>
  );
}

function FinalStats({
  you,
  opponent,
  stats,
  boardSize,
}: {
  you: PlayerInfo;
  opponent: PlayerInfo;
  stats: FinalPlayerStats[];
  boardSize: number;
}) {
  const row = (p: PlayerInfo, label: string) => {
    const s = stats.find((x) => x.playerId === p.id);
    if (!s) return null;
    return (
      <tr key={p.id}>
        <th scope="row">
          <PawnImage pawn={p.pawn} size={32} /> {label}
          <br />
          <strong>{p.nickname}</strong>
        </th>
        <td>{s.position >= boardSize ? "Chegou! 🏁" : `Casa ${s.position}`}</td>
        <td>{s.asked}</td>
        <td>{s.correct}</td>
      </tr>
    );
  };
  return (
    <table className="final-stats">
      <thead>
        <tr>
          <th scope="col">Jogador</th>
          <th scope="col">Posição final</th>
          <th scope="col">Perguntas</th>
          <th scope="col">Acertos</th>
        </tr>
      </thead>
      <tbody>
        {row(you, "Você")}
        {row(opponent, "Adversário")}
      </tbody>
    </table>
  );
}

function ResultCard({
  state,
  onExit,
  onRequestRematch,
  onDeclineRematch,
}: {
  state: MatchViewState;
  onExit: () => void;
  onRequestRematch: () => void;
  onDeclineRematch: () => void;
}) {
  const ended = state.ended;
  if (!ended) return null;
  const iWon = ended.winnerId !== null && ended.winnerId === state.you?.id;

  let title = "Partida encerrada";
  let detail = "";
  if (ended.endReason === "winner") {
    title = iWon ? "Você venceu! 🏆" : `${ended.winnerNickname ?? "O adversário"} venceu`;
    detail = ended.rankable ? "A partida vale para o ranking." : "Esta partida (revanche) não entra no ranking.";
  } else if (ended.endReason === "abandoned") {
    detail = "Alguém saiu ou perdeu a conexão. A partida terminou sem vencedor e fica fora do ranking.";
  } else if (ended.endReason === "time_limit") {
    detail = "O tempo máximo da partida acabou. Sem vencedor e fora do ranking.";
  }

  const opponentName = state.opponent?.nickname ?? "o adversário";
  const rematch = state.rematch;
  const iRequested = rematch?.requestedBy !== null && rematch?.requestedBy === state.you?.id;
  const opponentRequested = rematch?.requestedBy !== null && rematch?.requestedBy === state.opponent?.id;

  let rematchArea: ReactNode = null;
  if (ended.endReason !== "abandoned" && rematch) {
    switch (rematch.state) {
      case "idle":
        rematchArea = (
          <button className="button primary" onClick={onRequestRematch}>
            Revanche com {opponentName}
          </button>
        );
        break;
      case "pending":
        rematchArea = iRequested ? (
          <>
            <p className="notice" role="status">Pedido enviado. Aguardando {opponentName} aceitar (vale por 3 minutos)…</p>
            <button className="button" onClick={onDeclineRematch}>Desistir da revanche</button>
          </>
        ) : opponentRequested ? (
          <>
            <p className="notice" role="status">{opponentName} quer a revanche!</p>
            <div className="row center-row">
              <button className="button primary" onClick={onRequestRematch}>Aceitar revanche</button>
              <button className="button" onClick={onDeclineRematch}>Recusar</button>
            </div>
          </>
        ) : null;
        break;
      case "agreed":
        rematchArea = <p className="notice" role="status">Revanche combinada! Entrando na partida…</p>;
        break;
      case "declined":
        rematchArea = <p className="notice" role="status">A revanche foi recusada.</p>;
        break;
      case "expired":
        rematchArea = <p className="notice" role="status">O pedido de revanche expirou.</p>;
        break;
      case "cancelled":
        rematchArea = <p className="notice" role="status">{opponentName} saiu. Não há mais revanche.</p>;
        break;
      case "unavailable":
        rematchArea = <p className="notice" role="status">Não foi possível começar a revanche agora.</p>;
        break;
    }
  }

  return (
    <section className="card center result">
      <h1>{title}</h1>
      <p>{detail}</p>
      {state.you && state.opponent && (
        <>
          <BoardView boardSize={state.boardSize} players={state.players} you={state.you} opponent={state.opponent} currentPlayerId={null} compact />
          <FinalStats you={state.you} opponent={state.opponent} stats={ended.finalStats} boardSize={state.boardSize} />
        </>
      )}

      {rematchArea}
      <p className="hint">Revanche vale só para vocês dois e não entra no ranking: conta apenas a primeira partida.</p>
      <button className="button" onClick={onExit}>
        Novo adversário (voltar ao saguão)
      </button>
    </section>
  );
}
