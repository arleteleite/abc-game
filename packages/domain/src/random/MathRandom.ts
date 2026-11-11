import type { RandomSource } from "./RandomSource";

// Versão de produção: usa o gerador do ambiente.
export class MathRandom implements RandomSource {
  next(): number {
    return Math.random();
  }

  nextInt(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
}
