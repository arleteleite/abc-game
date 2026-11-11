import type { OptionKey, QuizPrompt, QuizSummary } from "@abc-game/domain";

// ---------------------------------------------------------------------------
// Quiz (HTTP). O token vai no cabeçalho Authorization: Bearer <token>.
//   POST /api/quiz/start   -> QuizStartResponse
//   POST /api/quiz/answer  -> QuizAnswerResponse
// ---------------------------------------------------------------------------

export interface QuizStartResponse {
  quizId: string;
  prompt: QuizPrompt;
}

export interface QuizAnswerRequest {
  quizId: string;
  questionId: string;
  /** null = não respondeu a tempo. */
  choice: OptionKey | null;
}

export interface QuizResultPayload extends QuizSummary {
  /** Posição no ranking pela melhor partida do jogador; null se o ranking não puder ser lido. */
  position: number | null;
  /** Quantos jogadores já têm partida no ranking. */
  players: number;
}

export interface QuizAnswerResponse {
  correct: boolean;
  timedOut: boolean;
  /** Revelada só depois da resposta. */
  correctKey: OptionKey;
  next: QuizPrompt | null;
  /** Só na última pergunta. */
  result: QuizResultPayload | null;
}
