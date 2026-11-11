import { describe, expect, it } from "vitest";
import { cellOfSquare, stageForPosition } from "./boardLayout";

describe("cellOfSquare (tabuleiro em cobrinha, 5 colunas)", () => {
  it("a primeira linha vai da esquerda para a direita", () => {
    expect([1, 2, 3, 4, 5].map((s) => cellOfSquare(s))).toEqual([
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 0, col: 4 },
    ]);
  });

  it("a segunda linha volta da direita para a esquerda", () => {
    expect(cellOfSquare(6)).toEqual({ row: 1, col: 4 });
    expect(cellOfSquare(10)).toEqual({ row: 1, col: 0 });
  });

  it("a terceira linha vai de novo para a direita, e a casa 15 fecha o caminho", () => {
    expect(cellOfSquare(11)).toEqual({ row: 2, col: 0 });
    expect(cellOfSquare(15)).toEqual({ row: 2, col: 4 });
  });

  it("casas consecutivas são sempre vizinhas (o caminho não 'pula')", () => {
    for (let s = 1; s < 15; s++) {
      const a = cellOfSquare(s);
      const b = cellOfSquare(s + 1);
      expect(Math.abs(a.row - b.row) + Math.abs(a.col - b.col)).toBe(1);
    }
  });
});

describe("stageForPosition (troca de cena nas casas 2, 4, 7 e 10)", () => {
  it.each([
    [0, 1], [1, 1], [2, 2], [3, 2], [4, 3], [6, 3], [7, 4], [9, 4], [10, 5], [15, 5],
  ])("casa %i → cena %i", (position, stage) => {
    expect(stageForPosition(position)).toBe(stage);
  });
});
