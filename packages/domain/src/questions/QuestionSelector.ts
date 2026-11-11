import type { Difficulty } from "../common/Difficulty";
import type { ListShuffler } from "../random/ListShuffler";
import type { Question } from "./Question";
import type { QuestionBank } from "./QuestionBank";

export class NotEnoughQuestionsError extends Error {
  constructor(level: Difficulty, requested: number, available: number) {
    super(`Banco sem perguntas suficientes no nível "${level}": pedidas ${requested}, existem ${available}`);
    this.name = "NotEnoughQuestionsError";
  }
}

// Sorteia perguntas de um nível. Prefere as ainda NÃO usadas; se acabarem,
// reaproveita as já usadas (decisão do PRD 5), sem repetir dentro do mesmo pedido.
export class QuestionSelector {
  constructor(
    private readonly bank: QuestionBank,
    private readonly shuffler: ListShuffler,
  ) {}

  pickMany(level: Difficulty, count: number, excludeIds: ReadonlySet<string> = new Set()): Question[] {
    const all = this.bank.ofLevel(level);
    if (count > all.length) throw new NotEnoughQuestionsError(level, count, all.length);

    const fresh = this.shuffler.shuffle(all.filter((q) => !excludeIds.has(q.id)));
    const picked = fresh.slice(0, count);
    if (picked.length < count) {
      const reused = this.shuffler.shuffle(all.filter((q) => excludeIds.has(q.id)));
      picked.push(...reused.slice(0, count - picked.length));
    }
    return picked;
  }

  pickOne(level: Difficulty, excludeIds: ReadonlySet<string> = new Set()): Question {
    return this.pickMany(level, 1, excludeIds)[0] as Question;
  }
}
