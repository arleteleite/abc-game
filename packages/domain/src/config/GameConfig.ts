import type { Difficulty } from "../common/Difficulty";

// TODOS os parâmetros do jogo ficam aqui (PRD 10.6). Mudar um valor após os
// testes é mexer só neste arquivo. Valores [P] ainda precisam de confirmação.

export type BoardEventKind = "stop" | "advance";

export interface BoardEventConfig {
  square: number;
  kind: BoardEventKind;
  /** stop: quantas vezes perde a vez · advance: quantas casas avança. */
  value: number;
  label: string;
}

export interface QuizConfig {
  /** Perguntas por nível; a soma é o total da partida (10). [P] 4/3/3 */
  mix: Record<Difficulty, number>;
  /** [P] */
  secondsPerQuestion: number;
}

export interface TrailConfig {
  boardSize: number;
  /** Casas avançadas por acerto, por nível. Difícil = 3 (decidido em 11/11). */
  advance: Record<Difficulty, number>;
  /** Proporção de cada nível POR JOGADOR; soma 1. [P] 40/30/30 */
  levelRatio: Record<Difficulty, number>;
  /**
   * Tamanho do bloco em que a proporção é garantida para cada jogador.
   * Com 10 e 40/30/30, a cada 10 perguntas do jogador vêm 4 fáceis, 3 médias
   * e 3 difíceis, em ordem aleatória. levelRatio × levelBlockSize deve dar inteiros.
   */
  levelBlockSize: number;
  /** [P] */
  secondsPerAnswer: number;
  matchTimeLimitSeconds: number;
  invitationSeconds: number;
  /** [P] */
  reconnectToleranceSeconds: number;
  startRaceMaxAttempts: number;
  /** Nível da pergunta da largada. [P] fácil, para que a largada seja decidida por rapidez. */
  startRaceDifficulty: Difficulty;
  events: readonly BoardEventConfig[];
}

export interface RankingConfig {
  topSize: number;
  /** [P] */
  pollingSeconds: number;
}

export interface NicknameConfig {
  minLength: number;
  maxLength: number;
  /** Termos bloqueados (sem acento e em minúsculas). [P] lista a ser fornecida pela responsável. */
  blockedTerms: readonly string[];
}

export interface QuestionBankConfig {
  minValidatedPerLevel: number;
  reducedMinValidatedPerLevel: number;
}

export interface GameConfig {
  quiz: QuizConfig;
  trail: TrailConfig;
  ranking: RankingConfig;
  questionBank: QuestionBankConfig;
  nickname: NicknameConfig;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  quiz: {
    mix: { facil: 4, media: 3, dificil: 3 },
    secondsPerQuestion: 15,
  },
  trail: {
    boardSize: 15,
    advance: { facil: 1, media: 2, dificil: 3 },
    levelRatio: { facil: 0.4, media: 0.3, dificil: 0.3 },
    levelBlockSize: 10,
    secondsPerAnswer: 12,
    matchTimeLimitSeconds: 600,
    invitationSeconds: 180,
    reconnectToleranceSeconds: 30,
    startRaceMaxAttempts: 3,
    startRaceDifficulty: "facil",
    events: [
      { square: 3, kind: "stop", value: 1, label: "Veranico" },
      { square: 5, kind: "advance", value: 2, label: "Assistência técnica" },
      { square: 8, kind: "stop", value: 1, label: "Fogo" },
      { square: 10, kind: "advance", value: 2, label: "FBN" },
    ],
  },
  ranking: { topSize: 5, pollingSeconds: 15 },
  questionBank: { minValidatedPerLevel: 30, reducedMinValidatedPerLevel: 20 },
  nickname: { minLength: 2, maxLength: 16, blockedTerms: [] },
};
