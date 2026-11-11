import type { Question } from "./Question";
import type { QuestionSelector } from "./QuestionSelector";
import type { TrailLevelPicker } from "./TrailLevelPicker";

// Entrega a próxima pergunta de um jogador numa partida da Trilha. O nível vem
// do TrailLevelPicker (proporção por jogador); a pergunta não se repete na
// partida (vale para os dois jogadores), exceto se o nível esgotar.
// Tem estado: um objeto por partida.
export class TrailQuestionDealer {
  private readonly used = new Set<string>();

  constructor(
    private readonly selector: QuestionSelector,
    private readonly levelPicker: TrailLevelPicker,
  ) {}

  next(playerId: string): Question {
    const question = this.selector.pickOne(this.levelPicker.next(playerId), this.used);
    this.used.add(question.id);
    return question;
  }
}
