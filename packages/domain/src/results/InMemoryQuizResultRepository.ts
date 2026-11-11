import type { QuizRecord } from "./QuizRecord";
import type { QuizResultRepository } from "./QuizResultRepository";

export class InMemoryQuizResultRepository implements QuizResultRepository {
  private readonly records = new Map<string, QuizRecord>();

  async save(record: QuizRecord): Promise<void> {
    if (!this.records.has(record.sessionId)) this.records.set(record.sessionId, record);
  }

  async all(): Promise<QuizRecord[]> {
    return [...this.records.values()];
  }
}
