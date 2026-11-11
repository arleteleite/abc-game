import type { MoveResult } from "./MoveResult";

export const PAWNS = ["vaca", "ovelha", "milho", "seringueira", "eucalipto"] as const;
export type Pawn = (typeof PAWNS)[number];

// O peão de um jogador na partida: guarda posição e vezes a perder.
export class PlayerPiece {
  private currentPosition = 0;
  private turnsToSkip = 0;

  constructor(
    readonly playerId: string,
    readonly pawn: Pawn,
  ) {}

  get position(): number {
    return this.currentPosition;
  }

  get skipsNextTurn(): boolean {
    return this.turnsToSkip > 0;
  }

  /** Aplica o resultado de um acerto calculado pelo Board. */
  apply(result: MoveResult): void {
    this.currentPosition = result.finalPosition;
    this.turnsToSkip += result.skipTurns;
  }

  /** Chamado quando chega a vez do jogador: se estava parado, perde a vez e devolve true. */
  consumeSkippedTurn(): boolean {
    if (this.turnsToSkip === 0) return false;
    this.turnsToSkip -= 1;
    return true;
  }
}
