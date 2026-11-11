import type { TrailRecord } from "./TrailRecord";

// Onde os resultados são guardados. O domínio só conhece esta interface;
// o Worker fornece a versão com D1.
export interface TrailResultRepository {
  /** Grava uma vez por partida: gravar o mesmo matchId de novo não duplica (idempotente). */
  save(record: TrailRecord): Promise<void>;
  /** Todos os registros (usado nos testes; o ranking final vem na etapa 8). */
  all(): Promise<TrailRecord[]>;
}
