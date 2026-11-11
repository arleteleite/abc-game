import type { Question } from "./Question";
import type { PresentedQuestion } from "./PublicQuestion";

// Transforma a pergunta completa na versão que vai ao celular + gabarito.
// Quem implementa é o AnswerShuffler.
export interface QuestionPresenter {
  present(question: Question): PresentedQuestion;
}
