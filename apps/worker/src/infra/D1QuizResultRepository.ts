import type { QuizRecord, QuizResultRepository } from "@abc-game/domain";

interface Row {
  session_id: string;
  player_id: string;
  nickname: string;
  correct_count: number;
  correct_ms: number;
  hard_correct_ms: number;
  ended_at: number;
}

// Resultados do Quiz no D1. `INSERT OR IGNORE` + chave session_id = idempotente.
export class D1QuizResultRepository implements QuizResultRepository {
  constructor(private readonly db: D1Database) {}

  async save(record: QuizRecord): Promise<void> {
    await this.db
      .prepare(
        "INSERT OR IGNORE INTO quiz_results (session_id, player_id, nickname, correct_count, correct_ms, hard_correct_ms, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(record.sessionId, record.playerId, record.nickname, record.correctCount, record.correctMs, record.hardCorrectMs, record.endedAt)
      .run();
  }

  async all(): Promise<QuizRecord[]> {
    const { results } = await this.db.prepare("SELECT * FROM quiz_results").all<Row>();
    return results.map((r) => ({
      sessionId: r.session_id,
      playerId: r.player_id,
      nickname: r.nickname,
      correctCount: r.correct_count,
      correctMs: r.correct_ms,
      hardCorrectMs: r.hard_correct_ms,
      endedAt: r.ended_at,
    }));
  }
}
