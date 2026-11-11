import { DIFFICULTIES, type Difficulty } from "../common/Difficulty";
import { InMemoryQuestionRepository } from "../questions/InMemoryQuestionRepository";
import type { Question } from "../questions/Question";
import { QuestionBank } from "../questions/QuestionBank";

// Apoio dos testes: cria perguntas falsas (id como "facil-01") sem depender do xlsx.
export function makeQuestion(difficulty: Difficulty, n: number, overrides: Partial<Question> = {}): Question {
  const id = `${difficulty}-${String(n).padStart(2, "0")}`;
  return {
    id,
    difficulty,
    theme: "tema",
    statement: `Enunciado ${id}`,
    options: { A: `${id} A`, B: `${id} B`, C: `${id} C`, D: `${id} D` },
    correct: "B",
    explanation: `Explicação ${id}`,
    source: "fonte",
    alert: "",
    status: "Validada",
    ...overrides,
  };
}

export function makeQuestions(perLevel: Record<Difficulty, number>): Question[] {
  return DIFFICULTIES.flatMap((level) =>
    Array.from({ length: perLevel[level] }, (_, i) => makeQuestion(level, i + 1)),
  );
}

export function makeBank(perLevel: Record<Difficulty, number>): QuestionBank {
  return new QuestionBank(new InMemoryQuestionRepository(makeQuestions(perLevel)));
}
