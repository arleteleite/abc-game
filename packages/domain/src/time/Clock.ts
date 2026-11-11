// Relógio. O domínio nunca chama Date.now direto: recebe esta interface,
// assim os testes avançam o tempo sem esperar.
export interface Clock {
  /** Milissegundos desde um ponto fixo (época Unix na versão real). */
  now(): number;
}
