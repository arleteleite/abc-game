import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_CONFIG } from "../config/GameConfig";
import { makeBank, makeQuestion } from "../testing/questionFixtures";
import { QuestionParser } from "./QuestionParser";

const parser = new QuestionParser();

describe("QuestionParser", () => {
  it("lê perguntas válidas", () => {
    const parsed = parser.parse([makeQuestion("facil", 1), makeQuestion("media", 1)]);
    expect(parsed.map((q) => q.id)).toEqual(["facil-01", "media-01"]);
  });

  it("rejeita id duplicado", () => {
    expect(() => parser.parse([makeQuestion("facil", 1), makeQuestion("facil", 1)])).toThrow("duplicada");
  });

  it("rejeita resposta correta fora de A–D", () => {
    const bad = { ...makeQuestion("facil", 1), correct: "E" };
    expect(() => parser.parse([bad])).toThrow("correta inválida");
  });

  it("rejeita alternativa vazia", () => {
    const q = makeQuestion("facil", 1);
    const bad = { ...q, options: { ...q.options, C: "  " } };
    expect(() => parser.parse([bad])).toThrow("alternativa C");
  });

  it("rejeita dificuldade e status inválidos", () => {
    expect(() => parser.parse([{ ...makeQuestion("facil", 1), difficulty: "super" }])).toThrow("dificuldade");
    expect(() => parser.parse([{ ...makeQuestion("facil", 1), status: "Qualquer" }])).toThrow("status");
  });

  it("rejeita entrada que não é lista", () => {
    expect(() => parser.parse({})).toThrow("lista");
  });
});

describe("QuestionBank.report", () => {
  it("conta por nível e compara com os mínimos (30 e 20)", () => {
    const config = DEFAULT_GAME_CONFIG.questionBank;
    expect(makeBank({ facil: 30, media: 30, dificil: 30 }).report(config)).toMatchObject({
      counts: { facil: 30, media: 30, dificil: 30 },
      meetsMinimum: true,
      meetsReducedMinimum: true,
    });
    expect(makeBank({ facil: 25, media: 30, dificil: 30 }).report(config)).toMatchObject({
      meetsMinimum: false,
      meetsReducedMinimum: true,
    });
    expect(makeBank({ facil: 10, media: 30, dificil: 30 }).report(config).meetsReducedMinimum).toBe(false);
  });
});
