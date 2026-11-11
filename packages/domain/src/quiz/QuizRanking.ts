import type { QuizRecord } from "../results/QuizRecord";

export interface QuizStanding {
  position: number;
  record: QuizRecord;
}

// Ranking do Quiz (PRD 6 e 8). Ordem de desempate:
//  1) mais acertos;
//  2) menor soma dos tempos das respostas corretas;
//  3) menor soma dos tempos das corretas de nível difícil;
//  4) partida mais antiga.
// Vale a melhor partida de cada jogador.
export class QuizRanking {
  /** Negativo se `a` fica à frente de `b`. */
  compare(a: QuizRecord, b: QuizRecord): number {
    return (
      b.correctCount - a.correctCount ||
      a.correctMs - b.correctMs ||
      a.hardCorrectMs - b.hardCorrectMs ||
      a.endedAt - b.endedAt
    );
  }

  /** A melhor partida de cada jogador, já na ordem do ranking. */
  standings(records: readonly QuizRecord[]): QuizStanding[] {
    const best = new Map<string, QuizRecord>();
    for (const record of records) {
      const current = best.get(record.playerId);
      if (!current || this.compare(record, current) < 0) best.set(record.playerId, record);
    }
    return [...best.values()].sort((a, b) => this.compare(a, b)).map((record, i) => ({ position: i + 1, record }));
  }

  top(records: readonly QuizRecord[], size: number): QuizStanding[] {
    return this.standings(records).slice(0, size);
  }

  /** Posição atual de um jogador (pela melhor partida dele), ou null se ele não tem partida. */
  positionOf(records: readonly QuizRecord[], playerId: string): number | null {
    return this.standings(records).find((s) => s.record.playerId === playerId)?.position ?? null;
  }
}
