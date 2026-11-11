import type { Difficulty } from "../common/Difficulty";
import type { PresentedQuestion, PublicQuestion } from "../questions/PublicQuestion";
import type { OptionKey } from "../questions/Question";

/** Uma pergunta da partida: o que precisa lembrar dela (e o gabarito, só no servidor). */
export interface QuizItem {
  questionId: string;
  difficulty: Difficulty;
  presented: PresentedQuestion;
}

export interface QuizAnswerRecord {
  questionId: string;
  difficulty: Difficulty;
  correct: boolean;
  timedOut: boolean;
  /** Tempo de resposta em ms (estouro conta o limite inteiro). */
  elapsedMs: number;
}

/** A pergunta que o celular vê: sem a resposta correta. */
export interface QuizPrompt {
  /** Posição da pergunta, começando em 0. */
  index: number;
  total: number;
  question: PublicQuestion;
  remainingMs: number;
}

export interface QuizSummary {
  correctCount: number;
  total: number;
  /** Soma dos tempos das respostas CORRETAS (1º desempate). */
  correctMs: number;
  /** Soma dos tempos das respostas corretas de nível difícil (2º desempate). */
  hardCorrectMs: number;
}

export interface QuizAnswerOutcome {
  correct: boolean;
  timedOut: boolean;
  /** Revelada só depois da resposta (letra na ordem embaralhada). */
  correctKey: OptionKey;
  next: QuizPrompt | null;
  summary: QuizSummary | null;
}

/** Tudo o que precisa ser guardado para retomar uma partida (o servidor pode ser descarregado). */
export interface QuizSnapshot {
  items: QuizItem[];
  answers: QuizAnswerRecord[];
  questionStartedAt: number | null;
}
