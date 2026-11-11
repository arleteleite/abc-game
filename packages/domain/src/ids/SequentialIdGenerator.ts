import type { IdGenerator } from "./IdGenerator";

// Para testes: p1, p2, p3...
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  constructor(private readonly prefix = "id") {}

  next(): string {
    this.counter += 1;
    return `${this.prefix}${this.counter}`;
  }
}
