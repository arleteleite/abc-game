import type { Question } from "./Question";
import type { QuestionRepository } from "./QuestionRepository";

// Guarda as perguntas em memória. Usado pelo Worker (com o JSON embutido) e nos testes.
export class InMemoryQuestionRepository implements QuestionRepository {
  constructor(private readonly questions: readonly Question[]) {}

  findPlayable(): readonly Question[] {
    return this.questions;
  }
}
