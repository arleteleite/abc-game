import type { Clock } from "../time/Clock";

// Guarda UM valor por um tempo. Serve para não recalcular (e não reler o banco)
// a cada requisição: quem chega dentro do prazo recebe o valor já calculado, e
// várias requisições simultâneas compartilham o mesmo cálculo.
export class TtlCache<T> {
  private value: { at: number; promise: Promise<T> } | null = null;

  constructor(
    private readonly clock: Clock,
    private readonly ttlMs: number,
  ) {}

  get(compute: () => Promise<T>): Promise<T> {
    const now = this.clock.now();
    if (this.value && now - this.value.at < this.ttlMs) return this.value.promise;
    const promise = compute();
    this.value = { at: now, promise };
    // Se o cálculo falhar, não guarda o erro: a próxima requisição tenta de novo.
    promise.catch(() => {
      if (this.value?.promise === promise) this.value = null;
    });
    return promise;
  }
}
