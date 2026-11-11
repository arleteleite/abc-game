import type { BoardEventKind } from "../config/GameConfig";

// Resultado de um acerto no tabuleiro.
export interface MoveResult {
  from: number;
  /** Casas ganhas só pela resposta (1, 2 ou 3). */
  answerAdvance: number;
  /** Casa onde a resposta o deixou, antes de qualquer evento. */
  landedOn: number;
  /** Evento disparado (só se parou numa casa de evento sem chegar ao fim). */
  event: { square: number; kind: BoardEventKind; label: string } | null;
  /** Posição final, limitada à última casa (sem bônus além dela). */
  finalPosition: number;
  /** Chegou ou passou da última casa: vence. */
  finished: boolean;
  /** Vezes que perde a vez por causa de evento. */
  skipTurns: number;
}
