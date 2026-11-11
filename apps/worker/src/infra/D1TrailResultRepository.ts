import type { TrailRecord, TrailResultRepository } from "@abc-game/domain";

interface Row {
  match_id: string;
  winner_nickname: string;
  loser_nickname: string;
  winner_total_answer_ms: number;
  ended_at: number;
}

// Guarda os resultados no D1. `INSERT OR IGNORE` + chave match_id = idempotente.
export class D1TrailResultRepository implements TrailResultRepository {
  constructor(private readonly db: D1Database) {}

  async save(record: TrailRecord): Promise<void> {
    await this.db
      .prepare(
        "INSERT OR IGNORE INTO trail_results (match_id, winner_nickname, loser_nickname, winner_total_answer_ms, ended_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(record.matchId, record.winnerNickname, record.loserNickname, record.winnerTotalAnswerMs, record.endedAt)
      .run();
  }

  async all(): Promise<TrailRecord[]> {
    const { results } = await this.db.prepare("SELECT * FROM trail_results ORDER BY ended_at").all<Row>();
    return results.map((r) => ({
      matchId: r.match_id,
      winnerNickname: r.winner_nickname,
      loserNickname: r.loser_nickname,
      winnerTotalAnswerMs: r.winner_total_answer_ms,
      endedAt: r.ended_at,
    }));
  }
}
