import type { Difficulty } from "../common/Difficulty";

export const OPTION_KEYS = ["A", "B", "C", "D"] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

export type QuestionStatus = "Rascunho" | "Revisada" | "Validada" | "Reprovada" | "Reescrever";

// Pergunta COMPLETA, com a resposta. Só existe no servidor: nunca vai ao celular.
export interface Question {
  id: string;
  difficulty: Difficulty;
  theme: string;
  statement: string;
  options: Record<OptionKey, string>;
  correct: OptionKey;
  explanation: string;
  source: string;
  alert: string;
  status: QuestionStatus;
}
