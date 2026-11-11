import type { RandomSource } from "./RandomSource";

// Embaralha uma lista (Fisher–Yates) sem alterar a original.
export class ListShuffler {
  constructor(private readonly random: RandomSource) {}

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.random.nextInt(i + 1);
      const a = copy[i] as T;
      copy[i] = copy[j] as T;
      copy[j] = a;
    }
    return copy;
  }
}
