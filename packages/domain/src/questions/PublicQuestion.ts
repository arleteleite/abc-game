import type { OptionKey } from "./Question";

// O que o celular recebe: enunciado e alternativas, SEM a resposta correta e
// SEM a explicação (PRD seção 5). `questionId` identifica a pergunta no servidor.
export interface PublicQuestion {
  questionId: string;
  statement: string;
  /** Alternativas já na ordem embaralhada, com letras A–D reatribuídas. */
  options: ReadonlyArray<{ key: OptionKey; text: string }>;
}

// Pergunta pronta para ser enviada: a parte pública e o gabarito (fica no servidor).
export interface PresentedQuestion {
  publicQuestion: PublicQuestion;
  /** Letra correta NA ORDEM EMBARALHADA. Nunca enviar ao cliente. */
  correctKey: OptionKey;
}
