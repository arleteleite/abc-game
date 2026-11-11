import { describe, expect, it } from "vitest";
import type { Difficulty } from "../common/Difficulty";
import { DEFAULT_GAME_CONFIG } from "../config/GameConfig";
import { ListShuffler } from "../random/ListShuffler";
import { SeededRandom } from "../random/SeededRandom";
import { makeBank } from "../testing/questionFixtures";
import { QuestionSelector } from "./QuestionSelector";
import { TrailLevelPicker } from "./TrailLevelPicker";
import { TrailQuestionDealer } from "./TrailQuestionDealer";

const pickerFor = (seed: number) =>
  new TrailLevelPicker(DEFAULT_GAME_CONFIG.trail, new ListShuffler(new SeededRandom(seed)));

const countLevels = (levels: Difficulty[]) => ({
  facil: levels.filter((l) => l === "facil").length,
  media: levels.filter((l) => l === "media").length,
  dificil: levels.filter((l) => l === "dificil").length,
});

describe("TrailLevelPicker (proporção garantida por jogador)", () => {
  it("a cada 10 perguntas de um jogador vêm exatamente 4 fáceis, 3 médias e 3 difíceis", () => {
    for (let seed = 0; seed < 20; seed++) {
      const picker = pickerFor(seed);
      for (let block = 0; block < 3; block++) {
        const levels = Array.from({ length: 10 }, () => picker.next("A"));
        expect(countLevels(levels)).toEqual({ facil: 4, media: 3, dificil: 3 });
      }
    }
  });

  it("cada jogador tem a sua própria sequência, ambos com a mesma proporção", () => {
    const picker = pickerFor(3);
    const a: Difficulty[] = [];
    const b: Difficulty[] = [];
    for (let i = 0; i < 10; i++) {
      a.push(picker.next("A"));
      b.push(picker.next("B"));
    }
    expect(countLevels(a)).toEqual({ facil: 4, media: 3, dificil: 3 });
    expect(countLevels(b)).toEqual({ facil: 4, media: 3, dificil: 3 });
  });

  it("a ordem dos níveis é aleatória (varia entre partidas)", () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const picker = pickerFor(seed);
      orders.add(Array.from({ length: 10 }, () => picker.next("A")).join());
    }
    expect(orders.size).toBeGreaterThan(5);
  });
});

describe("TrailQuestionDealer", () => {
  const dealerFor = (perLevel: { facil: number; media: number; dificil: number }, seed: number) => {
    const shuffler = new ListShuffler(new SeededRandom(seed));
    const selector = new QuestionSelector(makeBank(perLevel), shuffler);
    return new TrailQuestionDealer(selector, new TrailLevelPicker(DEFAULT_GAME_CONFIG.trail, shuffler));
  };

  it("não repete pergunta na partida (nem entre os dois jogadores) enquanto houver novas", () => {
    const dealer = dealerFor({ facil: 30, media: 30, dificil: 30 }, 5);
    const ids = Array.from({ length: 40 }, (_, i) => dealer.next(i % 2 === 0 ? "A" : "B").id);
    expect(new Set(ids).size).toBe(40);
  });

  it("mantém a proporção por jogador nas perguntas entregues", () => {
    const dealer = dealerFor({ facil: 30, media: 30, dificil: 30 }, 8);
    const levelsOf = (player: string) => Array.from({ length: 10 }, () => dealer.next(player).difficulty);
    expect(countLevels(levelsOf("A"))).toEqual({ facil: 4, media: 3, dificil: 3 });
    expect(countLevels(levelsOf("B"))).toEqual({ facil: 4, media: 3, dificil: 3 });
  });

  it("reaproveita perguntas quando o banco é pequeno, sem travar a partida", () => {
    const dealer = dealerFor({ facil: 2, media: 2, dificil: 2 }, 5);
    expect(Array.from({ length: 30 }, () => dealer.next("A"))).toHaveLength(30);
  });
});
