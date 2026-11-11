import { describe, expect, it } from "vitest";
import { stageForPosition, trailPath, trailPoint } from "./boardLayout";

describe("trailPoint (trilha sinuosa que sobe)", () => {
  it("a largada fica embaixo e a casa final no alto", () => {
    expect(trailPoint(0, 15).y).toBeGreaterThan(trailPoint(1, 15).y);
    expect(trailPoint(15, 15).y).toBeLessThan(trailPoint(1, 15).y);
  });

  it("o primeiro trecho vai para a direita e o segundo volta para a esquerda", () => {
    expect(trailPoint(5, 15).x).toBeGreaterThan(trailPoint(1, 15).x);
    expect(trailPoint(10, 15).x).toBeLessThan(trailPoint(6, 15).x);
  });

  it("todas as casas ficam dentro do tabuleiro e afastadas umas das outras", () => {
    const pts = Array.from({ length: 16 }, (_, i) => trailPoint(i, 15));
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        expect(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y)).toBeGreaterThan(5);
      }
  });

  it("funciona também para 20 casas", () => {
    expect(trailPoint(20, 20).y).toBeLessThan(trailPoint(1, 20).y);
  });

  it("o desenho do caminho tem uma curva por casa", () => {
    expect(trailPath(15).match(/C/g)).toHaveLength(15);
  });
});

describe("stageForPosition", () => {
  it("troca de cena nas casas 2, 4, 7 e 10", () => {
    expect([0, 1, 2, 3, 4, 6, 7, 9, 10, 15].map(stageForPosition)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
});
