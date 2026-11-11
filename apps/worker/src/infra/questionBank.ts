import { InMemoryQuestionRepository, QuestionBank, QuestionParser } from "@abc-game/domain";
// Gerado por `npm run bank:dev` (ou bank:prod) a partir do xlsx; não vai para o Git.
import raw from "../data/questions.json";

let cached: QuestionBank | null = null;

// O banco fica só no servidor (embutido no pacote do Worker). Lido uma vez por isolate.
export function getQuestionBank(): QuestionBank {
  if (!cached) {
    const questions = new QuestionParser().parse(raw);
    cached = new QuestionBank(new InMemoryQuestionRepository(questions));
  }
  return cached;
}
