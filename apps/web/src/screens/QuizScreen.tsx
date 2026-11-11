import type { OptionKey } from "@abc-game/domain";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiError, type ApiClient } from "../api/ApiClient";
import { Countdown } from "../components/Countdown";
import { QuestionCard } from "../components/QuestionCard";
import { useHeartbeat } from "../hooks/useHeartbeat";
import { errorText } from "../messages";
import { initialQuizState, quizReducer } from "../state/quizReducer";

interface Props {
  api: ApiClient;
  onExit: () => void;
  onSessionLost: () => void;
}

const QUESTION_MS = 15_000; // só para a barra; quem decide o estouro é o servidor

// Quiz solo: 10 perguntas, uma de cada vez. Sem pausa entre elas: o aviso sobre a
// resposta anterior aparece em cima da próxima pergunta, cujo relógio já está correndo.
export function QuizScreen({ api, onExit, onSessionLost }: Props) {
  const [state, dispatch] = useReducer(quizReducer, initialQuizState);
  const latest = useRef(state);
  latest.current = state;
  useHeartbeat(api, onSessionLost);

  const start = useCallback(async () => {
    dispatch({ type: "reset" });
    try {
      dispatch({ type: "started", response: await api.quizStart(), at: Date.now() });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "unknown";
      if (code === "unauthorized") onSessionLost();
      dispatch({ type: "failed", code });
    }
  }, [api, onSessionLost]);

  useEffect(() => {
    void start();
  }, [start]);

  const send = useCallback(
    async (choice: OptionKey | null) => {
      const current = latest.current;
      if (!current.prompt || !current.quizId || current.sending) return;
      dispatch({ type: "sending", choice });
      try {
        const response = await api.quizAnswer({ quizId: current.quizId, questionId: current.prompt.question.questionId, choice });
        dispatch({ type: "answered", response, at: Date.now() });
      } catch (error) {
        dispatch({ type: "failed", code: error instanceof ApiError ? error.code : "unknown" });
      }
    },
    [api],
  );

  // Acabou o tempo sem resposta: avisa o servidor (que já contou o estouro) e segue.
  const questionId = state.prompt?.question.questionId;
  useEffect(() => {
    if (!questionId || state.deadlineAt === null) return;
    const timer = setTimeout(() => void send(null), Math.max(0, state.deadlineAt - Date.now()) + 100);
    return () => clearTimeout(timer);
  }, [questionId, state.deadlineAt, send]);

  if (state.phase === "starting") return <main className="screen"><p className="hint center">Preparando o Quiz…</p></main>;

  if (state.phase === "error") {
    return (
      <main className="screen">
        <section className="card center">
          <p className="error" role="alert">
            <span aria-hidden="true">⚠ </span>
            {state.error === "question_bank_empty" ? "O Quiz ainda não tem perguntas disponíveis." : errorText(state.error ?? "unknown")}
          </p>
          <p className="hint">Se a conexão caiu, o Quiz recomeça do início.</p>
          <div className="row">
            <button className="button primary" onClick={() => void start()}>
              Recomeçar o Quiz
            </button>
            <button className="button" onClick={onExit}>
              Voltar ao menu
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (state.phase === "finished" && state.result) {
    const r = state.result;
    return (
      <main className="screen">
        {state.notice && <NoticeBanner notice={state.notice} />}
        <section className="card center result">
          <h1>Quiz concluído!</h1>
          <p className="big-number">
            {r.correctCount} de {r.total}
          </p>
          <p>acertos</p>
          <p>
            Tempo nas respostas certas: <strong>{(r.correctMs / 1000).toFixed(1)} s</strong>
          </p>
          {r.position !== null && (
            <p className="position">
              Sua melhor partida está em <strong>{r.position}º lugar</strong> entre {r.players} jogador{r.players === 1 ? "" : "es"}.
            </p>
          )}
          <div className="row center-row">
            <button className="button primary" onClick={() => void start()}>
              Jogar de novo
            </button>
            <button className="button" onClick={onExit}>
              Voltar ao menu
            </button>
          </div>
        </section>
      </main>
    );
  }

  const prompt = state.prompt;
  if (!prompt) return null;
  return (
    <main className="screen quiz">
      <header className="topbar">
        <strong>
          Pergunta {prompt.index + 1} de {prompt.total}
        </strong>
        <button
          className="button small"
          onClick={() => {
            if (window.confirm("Sair do Quiz? A partida em andamento é perdida.")) onExit();
          }}
        >
          Sair
        </button>
      </header>
      {state.notice && <NoticeBanner notice={state.notice} />}
      <Countdown deadlineAt={state.deadlineAt} totalMs={QUESTION_MS} />
      <QuestionCard question={prompt.question} selected={state.selected} onChoose={(choice) => void send(choice)} />
    </main>
  );
}

function NoticeBanner({ notice }: { notice: NonNullable<ReturnType<typeof quizReducer>["notice"]> }) {
  return (
    <div className={`banner ${notice.correct ? "good" : "bad"}`} role="status">
      <span aria-hidden="true">{notice.correct ? "✔ " : "✖ "}</span>
      <span className="banner-line">{notice.correct ? "Acertou!" : notice.timedOut ? "Tempo esgotado." : "Errou."}</span>
      {!notice.correct && (
        <span className="banner-line">
          Resposta certa: {notice.correctKey}) {notice.correctText}
        </span>
      )}
    </div>
  );
}
