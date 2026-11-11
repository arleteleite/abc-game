import type { TrailRecord } from "../results/TrailRecord";

export interface TrailStanding {
  position: number;
  record: TrailRecord;
}

// Ranking da Trilha (PRD 8): top partidas com vencedor, ordenadas pelo MENOR tempo
// do vencedor (soma dos tempos de resposta dele). Empate: a partida mais antiga.
// Partidas sem vencedor, abandonadas e revanches nunca chegam aqui: o servidor só
// grava partidas que valem para o ranking.
export class TrailRanking {
  compare(a: TrailRecord, b: TrailRecord): number {
    return a.winnerTotalAnswerMs - b.winnerTotalAnswerMs || a.endedAt - b.endedAt;
  }

  top(records: readonly TrailRecord[], size: number): TrailStanding[] {
    return [...records]
      .sort((a, b) => this.compare(a, b))
      .slice(0, size)
      .map((record, i) => ({ position: i + 1, record }));
  }
}
