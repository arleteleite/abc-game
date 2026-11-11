import type { Question } from "./Question";

// De onde vêm as perguntas. O domínio só conhece esta interface; quem fornece
// (JSON embutido no Worker, memória nos testes) fica fora do domínio.
export interface QuestionRepository {
  /** Somente perguntas aptas a serem sorteadas (status "Validada" em produção). */
  findPlayable(): readonly Question[];
}
