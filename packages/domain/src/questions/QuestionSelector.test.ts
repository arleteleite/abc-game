import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_CONFIG } from "../config/GameConfig";
import { ListShuffler } from "../random/ListShuffler";
import { SeededRandom } from "../random/SeededRandom";
import { makeBank } from "../testing/questionFixtures";
import { NotEnoughQuestionsError, QuestionSelector } from "./QuestionSelector";
import { QuizQuestionPlanner } from "./QuizQuestionPlanner";

const selectorFor = (perLevel: { facil: number; media: number; dificil: number }, seed = 1) =>
  new QuestionSelector(makeBank(perLevel), new ListShuffler(new SeededRandom(seed)));

describe("QuestionSelector", () => {
  it("sorteia a quantidade pedida, do nível pedido e sem repetir", () => {
    const picked = selectorFor({ facil: 10, media: 10, dificil: 10 }).pickMany("media", 5);
    expect(picked).toHaveLength(5);
    expect(new Set(picked.map((q) => q.id)).size).toBe(5);
    expect(picked.every((q) => q.difficulty === "media")).toBe(true);
  });

  it("evita as já usadas enquanto houver outras", () => {
    const selector = selectorFor({ facil: 5, media: 5, dificil: 5 });
    const used = new Set(["facil-01", "facil-02", "facil-03"]);
    const picked = selector.pickMany("facil", 2, used);
    expect(picked.map((q) => q.id).sort()).toEqual(["facil-04", "facil-05"]);
  });

  it("reaproveita as já usadas quando as novas acabam, sem repetir no mesmo pedido", () => {
    const selector = selectorFor({ facil: 4, media: 4, dificil: 4 });
    const used = new Set(["facil-01", "facil-02", "facil-03"]);
    const picked = selector.pickMany("facil", 3, used);
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((q) => q.id)).size).toBe(3);
    expect(picked.map((q) => q.id)).toContain("facil-04"); // a única nova entra
  });

  it("falha com erro claro se o nível tem menos perguntas que o pedido", () => {
    expect(() => selectorFor({ facil: 2, media: 5, dificil: 5 }).pickMany("facil", 3)).toThrow(NotEnoughQuestionsError);
  });

  it("a mesma semente dá o mesmo sorteio (reprodutível)", () => {
    const a = selectorFor({ facil: 20, media: 20, dificil: 20 }, 9).pickMany("dificil", 3).map((q) => q.id);
    const b = selectorFor({ facil: 20, media: 20, dificil: 20 }, 9).pickMany("dificil", 3).map((q) => q.id);
    expect(a).toEqual(b);
  });
});

const plannerFor = (perLevel: { facil: number; media: number; dificil: number }, seed: number) => {
  const shuffler = new ListShuffler(new SeededRandom(seed));
  return new QuizQuestionPlanner(new QuestionSelector(makeBank(perLevel), shuffler), shuffler, DEFAULT_GAME_CONFIG.quiz);
};

describe("QuizQuestionPlanner", () => {
  it("monta 10 perguntas distintas com 4 fáceis, 3 médias e 3 difíceis", () => {
    for (let seed = 0; seed < 20; seed++) {
      const plan = plannerFor({ facil: 30, media: 30, dificil: 30 }, seed).plan();
      expect(plan).toHaveLength(10);
      expect(new Set(plan.map((q) => q.id)).size).toBe(10);
      const count = (level: string) => plan.filter((q) => q.difficulty === level).length;
      expect([count("facil"), count("media"), count("dificil")]).toEqual([4, 3, 3]);
    }
  });

  it("a ordem de dificuldade é aleatória (varia entre partidas)", () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      orders.add(plannerFor({ facil: 30, media: 30, dificil: 30 }, seed).plan().map((q) => q.difficulty).join());
    }
    expect(orders.size).toBeGreaterThan(5);
  });

  it("partidas diferentes sorteiam perguntas diferentes", () => {
    const ids = (seed: number) =>
      plannerFor({ facil: 30, media: 30, dificil: 30 }, seed).plan().map((q) => q.id).join();
    expect(ids(1)).not.toBe(ids(2));
  });

  it("com o mínimo reduzido (20 por nível) ainda monta a partida", () => {
    expect(plannerFor({ facil: 20, media: 20, dificil: 20 }, 1).plan()).toHaveLength(10);
  });
});
