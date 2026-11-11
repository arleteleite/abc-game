import type { Difficulty } from "../common/Difficulty";
import type { Question } from "./Question";

// O que a partida precisa para pedir perguntas. Quem implementa é o
// TrailQuestionDealer; nos testes, uma versão com perguntas fixas.
export interface QuestionDealer {
  /** Próxima pergunta do jogador (nível definido pela proporção do jogador). */
  next(playerId: string): Question;
  /** Pergunta de um nível específico (usada na largada). */
  nextOfLevel(level: Difficulty): Question;
}
