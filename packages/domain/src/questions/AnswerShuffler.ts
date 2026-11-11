import type { ListShuffler } from "../random/ListShuffler";
import { OPTION_KEYS, type OptionKey, type Question } from "./Question";
import type { PresentedQuestion } from "./PublicQuestion";

// Embaralha as alternativas de uma pergunta e prepara o que vai ao celular.
// Responsabilidade única: montar a versão pública sem vazar o gabarito.
export class AnswerShuffler {
  constructor(private readonly shuffler: ListShuffler) {}

  present(question: Question): PresentedQuestion {
    const originalOrder = this.shuffler.shuffle<OptionKey>([...OPTION_KEYS]);

    const options = originalOrder.map((originalKey, index) => ({
      key: OPTION_KEYS[index] as OptionKey,
      text: question.options[originalKey],
    }));
    const correctIndex = originalOrder.indexOf(question.correct);

    return {
      publicQuestion: {
        questionId: question.id,
        statement: question.statement,
        options,
      },
      correctKey: OPTION_KEYS[correctIndex] as OptionKey,
    };
  }
}
