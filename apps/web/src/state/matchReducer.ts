import type { OptionKey, MoveResult, PublicQuestion } from "@abc-game/domain";
import type { PlayerInfo, PlayerState, ServerMessage } from "@abc-game/protocol";
import type { ConnectionStatus } from "../net/MatchConnection";

export interface RematchView {
  state: "idle" | "pending" | "agreed" | "declined" | "expired" | "cancelled" | "unavailable";
  requestedBy: string | null;
}

export type MatchPhase = "connecting" | "waiting" | "race" | "playing" | "ended";

export interface Feedback {
  playerId: string;
  correct: boolean;
  timedOut: boolean;
  correctKey: OptionKey;
  move: MoveResult | null;
  skippedPlayerIds: string[];
  /** Instante em que chegou (para o aviso sumir sozinho). */
  at: number;
}

// Tudo o que a tela da partida precisa saber. Só o reducer altera este objeto.
export interface MatchViewState {
  phase: MatchPhase;
  connection: ConnectionStatus;
  you: PlayerInfo | null;
  opponent: PlayerInfo | null;
  boardSize: number;
  players: PlayerState[];
  currentPlayerId: string | null;
  /** Pergunta na tela (largada ou minha vez). */
  question: PublicQuestion | null;
  questionKind: "race" | "turn" | null;
  /** Instante (relógio do celular) em que o tempo da pergunta acaba. */
  deadlineAt: number | null;
  selected: OptionKey | null;
  /** Vez do adversário: não há pergunta na tela. */
  opponentDeadlineAt: number | null;
  raceStarter: string | null;
  feedback: Feedback | null;
  opponentConnected: boolean;
  /** Situação da revanche depois do fim da partida. */
  rematch: RematchView | null;
  /** Revanche combinada: identificador da partida nova (a tela troca para ela). */
  nextMatchId: string | null;
  ended: { endReason: string; winnerId: string | null; winnerNickname: string | null; rankable: boolean } | null;
  error: string | null;
}

export type MatchAction =
  | { type: "message"; message: ServerMessage; at: number }
  | { type: "connection"; status: ConnectionStatus }
  | { type: "local_answer"; choice: OptionKey }
  | { type: "clear_feedback" };

export const initialMatchState: MatchViewState = {
  phase: "connecting",
  connection: "connecting",
  you: null,
  opponent: null,
  boardSize: 15,
  players: [],
  currentPlayerId: null,
  question: null,
  questionKind: null,
  deadlineAt: null,
  selected: null,
  opponentDeadlineAt: null,
  raceStarter: null,
  feedback: null,
  opponentConnected: true,
  rematch: null,
  nextMatchId: null,
  ended: null,
  error: null,
};

export function matchReducer(state: MatchViewState, action: MatchAction): MatchViewState {
  switch (action.type) {
    case "connection":
      return { ...state, connection: action.status };
    case "local_answer":
      return { ...state, selected: action.choice };
    case "clear_feedback":
      return { ...state, feedback: null };
    case "message":
      return applyMessage(state, action.message, action.at);
  }
}

function applyMessage(state: MatchViewState, m: ServerMessage, at: number): MatchViewState {
  switch (m.type) {
    case "welcome":
      return {
        ...state,
        you: m.you,
        opponent: m.opponent,
        boardSize: m.boardSize,
        phase: state.phase === "connecting" ? "waiting" : state.phase,
        opponentConnected: true,
        error: null,
      };
    case "waiting_opponent":
      return { ...state, phase: "waiting" };
    case "race_question":
      return {
        ...state,
        phase: "race",
        question: m.question,
        questionKind: "race",
        deadlineAt: at + m.remainingMs,
        selected: null,
        opponentDeadlineAt: null,
      };
    case "race_waiting":
      return state;
    case "race_decided":
      return { ...state, raceStarter: m.starter, question: null, questionKind: null, deadlineAt: null, selected: null };
    case "turn_question":
      return {
        ...state,
        phase: "playing",
        question: m.question,
        questionKind: "turn",
        deadlineAt: at + m.remainingMs,
        selected: null,
        opponentDeadlineAt: null,
      };
    case "opponent_turn":
      return {
        ...state,
        phase: "playing",
        question: null,
        questionKind: null,
        deadlineAt: null,
        selected: null,
        currentPlayerId: m.playerId,
        opponentDeadlineAt: at + m.remainingMs,
      };
    case "answer_result":
      return {
        ...state,
        feedback: {
          playerId: m.playerId,
          correct: m.correct,
          timedOut: m.timedOut,
          correctKey: m.correctKey,
          move: m.move,
          skippedPlayerIds: m.skippedPlayerIds,
          at,
        },
      };
    case "state":
      return { ...state, players: m.players, currentPlayerId: m.currentPlayerId };
    case "opponent_status":
      return { ...state, opponentConnected: m.connected };
    case "match_ended":
      return {
        ...state,
        phase: "ended",
        question: null,
        questionKind: null,
        deadlineAt: null,
        opponentDeadlineAt: null,
        ended: {
          endReason: m.result.endReason,
          winnerId: m.result.winnerId,
          winnerNickname: m.winnerNickname,
          rankable: m.result.rankable,
        },
      };
    case "rematch_status":
      return { ...state, rematch: { state: m.state, requestedBy: m.requestedBy } };
    case "rematch_started":
      return { ...state, nextMatchId: m.matchId };
    case "error":
      return { ...state, error: m.reason };
    case "pong":
      return state;
  }
}
