import type { TrailRecord } from "./TrailRecord";
import type { TrailResultRepository } from "./TrailResultRepository";

export class InMemoryTrailResultRepository implements TrailResultRepository {
  private readonly records = new Map<string, TrailRecord>();

  async save(record: TrailRecord): Promise<void> {
    if (!this.records.has(record.matchId)) this.records.set(record.matchId, record);
  }

  async all(): Promise<TrailRecord[]> {
    return [...this.records.values()];
  }
}
