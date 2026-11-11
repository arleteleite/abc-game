import type { MoveResult } from "../board/MoveResult";
import type { OptionKey } from "../questions/Question";
import type { PublicQuestion } from "../questions/PublicQuestion";
import type { AnswerRejection } from "./TurnManager";
import type { RaceDecision } from "./StartRace";

export type MatchPhase = "race" | "playing" | "finished";
export type EndReason = "winner" | "abandoned" | "time_limit";

/** Quantas perguntas da vez o jogador respondeu (ou estourou) e quantas acertou. */
export interface PlayerStats {
  playerId: string;
  asked: number;
  correct: number;
}

export interface MatchResult {
  endReason: EndReason;
  winnerId: string | null;
  abandonedBy: string | null;
  /** Soma dos tempos de resposta do vencedor (estouro conta o limite inteiro). */
  winnerTotalAnswerMs: number | null;
  /** Pode entrar no ranking: só partida com vencedor e que não seja revanche. */
  rankable: boolean;
}

/** Pergunta da largada, enviada aos dois jogadores. */
export interface RacePrompt {
  question: PublicQuestion;
  attempt: number;
  deadlineAt: number;
}

/** Pergunta da vez, enviada ao jogador da vez. */
export interface TurnPrompt {
  playerId: string;
  question: PublicQuestion;
  deadlineAt: number;
}

export type RaceOutcome =
  | { status: "waiting" }
  | { status: "retry"; prompt: RacePrompt }
  | { status: "decided"; starter: string; reason: RaceDecision; prompt: TurnPrompt };

export interface AnswerOutcome {
  playerId: string;
  correct: boolean;
  timedOut: boolean;
  /** Revelada só depois da resposta (letra na ordem embaralhada). */
  correctKey: OptionKey;
  move: MoveResult | null;
  /** Jogadores que perderam a vez por estarem parados. */
  skippedPlayerIds: string[];
  finished: boolean;
  /** Próxima pergunta; null se a partida terminou. */
  next: TurnPrompt | null;
}

export type MatchRejection =
  | AnswerRejection
  | "match_finished"
  | "not_in_race"
  | "not_playing"
  | "unknown_player";

export type TickResult =
  | { kind: "match_ended"; result: MatchResult }
  | { kind: "race_expired"; outcome: RaceOutcome }
  | { kind: "turn_expired"; outcome: AnswerOutcome };

export interface MatchSnapshot {
  phase: MatchPhase;
  currentPlayerId: string | null;
  players: Array<{ playerId: string; position: number; skipsNextTurn: boolean }>;
}
