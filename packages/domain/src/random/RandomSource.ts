// Fonte de números aleatórios. O domínio nunca chama Math.random direto:
// recebe esta interface, assim os testes usam uma versão previsível.
export interface RandomSource {
  /** Número real em [0, 1). */
  next(): number;
  /** Inteiro em [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}
