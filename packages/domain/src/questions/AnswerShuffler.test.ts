import { describe, expect, it } from "vitest";
import { ListShuffler } from "../random/ListShuffler";
import { SeededRandom } from "../random/SeededRandom";
import { makeQuestion } from "../testing/questionFixtures";
import { AnswerShuffler } from "./AnswerShuffler";

describe("AnswerShuffler", () => {
  const question = makeQuestion("facil", 1, { correct: "C" });

  it("a parte pública NÃO contém a resposta nem a explicação (teste de contrato)", () => {
    const { publicQuestion } = new AnswerShuffler(new ListShuffler(new SeededRandom(3))).present(question);
    const serialized = JSON.stringify(publicQuestion);
    expect(serialized).not.toContain("correct");
    expect(serialized).not.toContain("explanation");
    expect(serialized).not.toContain(question.explanation);
    expect(Object.keys(publicQuestion).sort()).toEqual(["options", "questionId", "statement"]);
  });

  it("mantém as 4 alternativas, com letras A–D sem repetir", () => {
    const { publicQuestion } = new AnswerShuffler(new ListShuffler(new SeededRandom(5))).present(question);
    expect(publicQuestion.options.map((o) => o.key)).toEqual(["A", "B", "C", "D"]);
    expect(publicQuestion.options.map((o) => o.text).sort()).toEqual(Object.values(question.options).sort());
  });

  it("o gabarito aponta para o texto da alternativa correta, em qualquer embaralhamento", () => {
    for (let seed = 0; seed < 50; seed++) {
      const { publicQuestion, correctKey } = new AnswerShuffler(new ListShuffler(new SeededRandom(seed))).present(question);
      const chosen = publicQuestion.options.find((o) => o.key === correctKey);
      expect(chosen?.text).toBe(question.options.C);
    }
  });

  it("a letra da correta varia entre partidas (não fica sempre no mesmo lugar)", () => {
    const keys = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      keys.add(new AnswerShuffler(new ListShuffler(new SeededRandom(seed))).present(question).correctKey);
    }
    expect(keys.size).toBeGreaterThan(1);
  });
});
