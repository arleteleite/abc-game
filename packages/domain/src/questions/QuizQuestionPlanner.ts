import { DIFFICULTIES } from "../common/Difficulty";
import type { QuizConfig } from "../config/GameConfig";
import type { ListShuffler } from "../random/ListShuffler";
import type { Question } from "./Question";
import type { QuestionSelector } from "./QuestionSelector";

// Monta as perguntas de UMA partida de Quiz: quantas de cada nível (4/3/3),
// sem repetir entre si, e depois embaralha a ORDEM (decidido em 11/11: a ordem
// de dificuldade é aleatória).
export class QuizQuestionPlanner {
  constructor(
    private readonly selector: QuestionSelector,
    private readonly shuffler: ListShuffler,
    private readonly config: QuizConfig,
  ) {}

  plan(): Question[] {
    const chosen: Question[] = [];
    for (const level of DIFFICULTIES) {
      const alreadyUsed = new Set(chosen.map((q) => q.id));
      chosen.push(...this.selector.pickMany(level, this.config.mix[level], alreadyUsed));
    }
    return this.shuffler.shuffle(chosen);
  }
}
