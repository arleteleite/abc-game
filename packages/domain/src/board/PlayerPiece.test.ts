import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_CONFIG } from "../config/GameConfig";
import { Board } from "./Board";
import { PlayerPiece } from "./PlayerPiece";

const board = new Board(DEFAULT_GAME_CONFIG.trail);

describe("PlayerPiece", () => {
  it("começa na casa 0 e sem vez a perder", () => {
    const piece = new PlayerPiece("A", "vaca");
    expect(piece.position).toBe(0);
    expect(piece.skipsNextTurn).toBe(false);
  });

  it("acumula a posição conforme os acertos", () => {
    const piece = new PlayerPiece("A", "vaca");
    piece.apply(board.moveAfterCorrectAnswer(piece.position, "media")); // 2
    piece.apply(board.moveAfterCorrectAnswer(piece.position, "facil")); // 3 (Veranico)
    expect(piece.position).toBe(3);
  });

  it("parar numa casa de evento 'parado' faz perder exatamente a próxima vez", () => {
    const piece = new PlayerPiece("A", "ovelha");
    piece.apply(board.moveAfterCorrectAnswer(2, "facil")); // casa 3: Veranico
    expect(piece.skipsNextTurn).toBe(true);
    expect(piece.consumeSkippedTurn()).toBe(true); // perde a vez
    expect(piece.consumeSkippedTurn()).toBe(false); // a seguinte joga normal
    expect(piece.skipsNextTurn).toBe(false);
  });
});
