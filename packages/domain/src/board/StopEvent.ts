import type { BoardEvent, EventEffect } from "./BoardEvent";

// Veranico e Fogo: o jogador fica parado e perde a próxima vez dele.
export class StopEvent implements BoardEvent {
  readonly kind = "stop" as const;

  constructor(
    readonly square: number,
    readonly label: string,
    private readonly rounds: number,
  ) {}

  apply(): EventEffect {
    return { extraAdvance: 0, skipTurns: this.rounds };
  }
}
