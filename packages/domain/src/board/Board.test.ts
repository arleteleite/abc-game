import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_CONFIG, type TrailConfig } from "../config/GameConfig";
import { Board } from "./Board";
import type { Difficulty } from "../common/Difficulty";

const board = new Board(DEFAULT_GAME_CONFIG.trail);

describe("Board: tabela de casos do PRD 7.3 (15 casas, difícil = 3)", () => {
  // [posição inicial, nível, casa onde parou, posição final, evento, perde vezes, terminou]
  const cases: Array<[number, Difficulty, number, number, string | null, number, boolean]> = [
    [0, "media", 2, 2, null, 0, false],
    [1, "dificil", 4, 4, null, 0, false], // passou pela casa 3 sem parar: não dispara
    [2, "facil", 3, 3, "Veranico", 1, false],
    [3, "media", 5, 7, "Assistência técnica", 0, false], // +2; casa 7 não tem evento
    [4, "facil", 5, 7, "Assistência técnica", 0, false],
    [7, "facil", 8, 8, "Fogo", 1, false],
    [8, "media", 10, 12, "FBN", 0, false], // +2 e para na 12
    [7, "dificil", 10, 12, "FBN", 0, false],
    [12, "dificil", 15, 15, null, 0, true], // chega exatamente à 15
    [14, "media", 16, 15, null, 0, true], // passa da 15: vence, posição limitada a 15
    [13, "dificil", 16, 15, null, 0, true],
  ];

  it.each(cases)("de %i com %s", (from, level, landedOn, finalPosition, eventLabel, skipTurns, finished) => {
    const result = board.moveAfterCorrectAnswer(from, level);
    expect(result.landedOn).toBe(landedOn);
    expect(result.finalPosition).toBe(finalPosition);
    expect(result.event?.label ?? null).toBe(eventLabel);
    expect(result.skipTurns).toBe(skipTurns);
    expect(result.finished).toBe(finished);
  });
});

describe("Board: eventos não encadeiam", () => {
  it("o avanço de um evento não dispara outro evento", () => {
    // Evento na 5 avança 3 e cai na 8, que é "Fogo". O Fogo NÃO pode disparar.
    const config: TrailConfig = {
      ...DEFAULT_GAME_CONFIG.trail,
      events: [
        { square: 5, kind: "advance", value: 3, label: "Assistência técnica" },
        { square: 8, kind: "stop", value: 1, label: "Fogo" },
      ],
    };
    const result = new Board(config).moveAfterCorrectAnswer(3, "media"); // 3+2 = 5
    expect(result.event?.label).toBe("Assistência técnica");
    expect(result.finalPosition).toBe(8);
    expect(result.skipTurns).toBe(0);
  });

  it("evento que empurra além do fim termina o jogo sem bônus", () => {
    const config: TrailConfig = {
      ...DEFAULT_GAME_CONFIG.trail,
      boardSize: 12,
      events: [{ square: 10, kind: "advance", value: 5, label: "FBN" }],
    };
    const result = new Board(config).moveAfterCorrectAnswer(8, "media");
    expect(result.finalPosition).toBe(12);
    expect(result.finished).toBe(true);
  });
});

describe("Board: parâmetros vêm da configuração", () => {
  it("usa o avanço configurado para cada nível", () => {
    const config: TrailConfig = {
      ...DEFAULT_GAME_CONFIG.trail,
      advance: { facil: 1, media: 2, dificil: 5 },
      events: [],
    };
    expect(new Board(config).moveAfterCorrectAnswer(0, "dificil").finalPosition).toBe(5);
  });

  it("expõe o tamanho do tabuleiro", () => {
    expect(board.size).toBe(15);
  });
});
