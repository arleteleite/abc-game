import { describe, expect, it } from "vitest";
import type { TrailRecord } from "../results/TrailRecord";
import { TrailRanking } from "./TrailRanking";

const rec = (over: Partial<TrailRecord>): TrailRecord => ({
  matchId: "m",
  winnerNickname: "Ana",
  loserNickname: "Beto",
  winnerTotalAnswerMs: 60_000,
  endedAt: 100,
  ...over,
});

describe("TrailRanking", () => {
  const ranking = new TrailRanking();

  it("menor tempo do vencedor fica na frente", () => {
    const top = ranking.top([rec({ matchId: "a", winnerTotalAnswerMs: 70_000 }), rec({ matchId: "b", winnerTotalAnswerMs: 50_000 })], 5);
    expect(top.map((s) => s.record.matchId)).toEqual(["b", "a"]);
    expect(top.map((s) => s.position)).toEqual([1, 2]);
  });

  it("empate no tempo: a partida mais antiga fica na frente", () => {
    const top = ranking.top([rec({ matchId: "novo", endedAt: 300 }), rec({ matchId: "antigo", endedAt: 200 })], 5);
    expect(top[0]?.record.matchId).toBe("antigo");
  });

  it("mostra só o top 5 e não altera a lista original", () => {
    const records = Array.from({ length: 8 }, (_, i) => rec({ matchId: `m${i}`, winnerTotalAnswerMs: 80_000 - i * 1000 }));
    const copy = [...records];
    const top = ranking.top(records, 5);
    expect(top).toHaveLength(5);
    expect(top[0]?.record.matchId).toBe("m7");
    expect(records).toEqual(copy);
  });

  it("sem partidas, o ranking é vazio", () => {
    expect(ranking.top([], 5)).toEqual([]);
  });
});
