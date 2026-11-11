import type { OptionKey } from "@abc-game/domain";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { MatchConnection } from "../net/MatchConnection";
import { initialMatchState, matchReducer, type MatchViewState } from "../state/matchReducer";
import { FEEDBACK_MS } from "../constants";

// Liga a tela da partida ao servidor: abre o WebSocket, entrega as mensagens
// ao reducer e oferece `answer` e `leave` para a tela.
export function useMatch(matchId: string, token: string) {
  const [state, dispatch] = useReducer(matchReducer, initialMatchState);
  const connection = useRef<MatchConnection | null>(null);
  const latest = useRef<MatchViewState>(state);
  latest.current = state;

  useEffect(() => {
    const conn = new MatchConnection(matchId, token, {
      onMessage: (message) => dispatch({ type: "message", message, at: Date.now() }),
      onStatus: (status) => dispatch({ type: "connection", status }),
    });
    connection.current = conn;
    conn.start();
    return () => conn.close();
  }, [matchId, token]);

  // O aviso de acerto/erro some sozinho.
  useEffect(() => {
    if (!state.feedback) return;
    const timer = setTimeout(() => dispatch({ type: "clear_feedback" }), FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [state.feedback]);

  const answer = useCallback((choice: OptionKey) => {
    const current = latest.current;
    if (!current.question || current.selected) return; // uma resposta por pergunta
    dispatch({ type: "local_answer", choice });
    connection.current?.send({
      type: current.questionKind === "race" ? "race_answer" : "answer",
      questionId: current.question.questionId,
      choice,
    });
  }, []);

  const leave = useCallback(() => {
    connection.current?.send({ type: "leave" });
  }, []);

  return { state, answer, leave };
}
