import type { Clock } from "../time/Clock";

export type ConnectionStatus =
  | { state: "connected" }
  | { state: "grace"; remainingMs: number }
  | { state: "abandoned" };

// Controla quem caiu e há quanto tempo (PRD 7.4). Dentro da tolerância o jogador
// pode voltar; passada a tolerância, vale como abandono.
export class DisconnectPolicy {
  private readonly droppedAt = new Map<string, number>();
  private readonly toleranceMs: number;

  constructor(
    private readonly clock: Clock,
    toleranceSeconds: number,
  ) {
    this.toleranceMs = toleranceSeconds * 1000;
  }

  markDisconnected(playerId: string): void {
    if (!this.droppedAt.has(playerId)) this.droppedAt.set(playerId, this.clock.now());
  }

  /** Volta dentro da tolerância: retoma. Depois dela, continua abandonado. */
  markReconnected(playerId: string): boolean {
    if (this.statusOf(playerId).state === "abandoned") return false;
    this.droppedAt.delete(playerId);
    return true;
  }

  statusOf(playerId: string): ConnectionStatus {
    const at = this.droppedAt.get(playerId);
    if (at === undefined) return { state: "connected" };
    const elapsed = this.clock.now() - at;
    if (elapsed >= this.toleranceMs) return { state: "abandoned" };
    return { state: "grace", remainingMs: this.toleranceMs - elapsed };
  }

  /** Primeiro jogador que estourou a tolerância, se houver. */
  abandonedPlayer(): string | null {
    for (const playerId of this.droppedAt.keys()) {
      if (this.statusOf(playerId).state === "abandoned") return playerId;
    }
    return null;
  }
}
