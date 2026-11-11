import { DIFFICULTIES, type Difficulty } from "../common/Difficulty";
import type { QuestionBankConfig } from "../config/GameConfig";
import type { Question } from "./Question";
import type { QuestionRepository } from "./QuestionRepository";

export interface BankReport {
  counts: Record<Difficulty, number>;
  /** Todos os níveis têm pelo menos o mínimo normal (30). */
  meetsMinimum: boolean;
  /** Todos os níveis têm pelo menos o mínimo reduzido (20). */
  meetsReducedMinimum: boolean;
}

// Organiza as perguntas jogáveis por nível e diz se o banco tem o mínimo.
// O jogo NÃO bloqueia por falta de perguntas (PRD 5): reaproveita. O relatório
// serve para avisar a gerente.
export class QuestionBank {
  private readonly byLevel: Record<Difficulty, Question[]> = { facil: [], media: [], dificil: [] };

  constructor(repository: QuestionRepository) {
    for (const q of repository.findPlayable()) this.byLevel[q.difficulty].push(q);
  }

  ofLevel(level: Difficulty): readonly Question[] {
    return this.byLevel[level];
  }

  report(config: QuestionBankConfig): BankReport {
    const counts = {} as Record<Difficulty, number>;
    for (const level of DIFFICULTIES) counts[level] = this.byLevel[level].length;
    const smallest = Math.min(...DIFFICULTIES.map((level) => counts[level]));
    return {
      counts,
      meetsMinimum: smallest >= config.minValidatedPerLevel,
      meetsReducedMinimum: smallest >= config.reducedMinValidatedPerLevel,
    };
  }
}
