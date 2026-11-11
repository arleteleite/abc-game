import type { BoardEvent, EventEffect } from "./BoardEvent";

// Assistência técnica e FBN: o jogador avança casas extras.
export class AdvanceEvent implements BoardEvent {
  readonly kind = "advance" as const;

  constructor(
    readonly square: number,
    readonly label: string,
    private readonly squares: number,
  ) {}

  apply(): EventEffect {
    return { extraAdvance: this.squares, skipTurns: 0 };
  }
}
