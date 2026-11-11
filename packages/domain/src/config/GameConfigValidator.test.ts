import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_CONFIG, type GameConfig } from "./GameConfig";
import { GameConfigValidator } from "./GameConfigValidator";

const validator = new GameConfigValidator();

describe("GameConfigValidator", () => {
  it("aceita a configuração padrão", () => {
    expect(validator.validate(DEFAULT_GAME_CONFIG)).toEqual([]);
  });

  it("o Quiz padrão soma 10 perguntas (4/3/3)", () => {
    const { mix } = DEFAULT_GAME_CONFIG.quiz;
    expect(mix.facil + mix.media + mix.dificil).toBe(10);
  });

  it("rejeita proporção da Trilha que não soma 1", () => {
    const config: GameConfig = {
      ...DEFAULT_GAME_CONFIG,
      trail: { ...DEFAULT_GAME_CONFIG.trail, levelRatio: { facil: 0.5, media: 0.3, dificil: 0.3 } },
    };
    expect(validator.validate(config).join()).toContain("somar 1");
  });

  it("rejeita bloco cuja proporção não dá números inteiros", () => {
    const config: GameConfig = {
      ...DEFAULT_GAME_CONFIG,
      trail: { ...DEFAULT_GAME_CONFIG.trail, levelBlockSize: 7 },
    };
    expect(validator.validate(config).join()).toContain("levelBlockSize");
  });

  it("rejeita evento fora do tabuleiro e casas repetidas", () => {
    const config: GameConfig = {
      ...DEFAULT_GAME_CONFIG,
      trail: {
        ...DEFAULT_GAME_CONFIG.trail,
        events: [
          { square: 15, kind: "stop", value: 1, label: "Fora" },
          { square: 5, kind: "advance", value: 2, label: "A" },
          { square: 5, kind: "stop", value: 1, label: "B" },
        ],
      },
    };
    const problems = validator.validate(config).join("\n");
    expect(problems).toContain("fora do tabuleiro");
    expect(problems).toContain("duas ocorrências");
  });

  it("assertValid lança erro com a lista de problemas", () => {
    const config: GameConfig = {
      ...DEFAULT_GAME_CONFIG,
      trail: { ...DEFAULT_GAME_CONFIG.trail, boardSize: 1, events: [] },
    };
    expect(() => validator.assertValid(config)).toThrow("Configuração do jogo inválida");
  });
});
