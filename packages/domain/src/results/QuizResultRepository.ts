import type { QuizRecord } from "./QuizRecord";

export interface QuizResultRepository {
  /** Gravar a mesma partida (sessionId) de novo não duplica. */
  save(record: QuizRecord): Promise<void>;
  all(): Promise<QuizRecord[]>;
}
