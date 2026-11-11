import { fail, ok, type Result } from "../common/Result";
import type { Clock } from "../time/Clock";

export type RematchState = "idle" | "pending" | "agreed" | "declined" | "expired" | "cancelled";
export type RematchProblem = "closed" | "unknown_player";

export interface RematchStatus {
  state: RematchState;
  /** Quem pediu a revanche primeiro (enquanto pendente). */
  requestedBy: string | null;
  expiresAt: number | null;
}

// A revanche de uma partida que acabou (PRD 7.6): mesmos jogadores e peões, partida nova.
// Só acontece se os DOIS aceitarem, dentro de 3 minutos do primeiro pedido.
//  - o primeiro a pedir deixa a oferta "pendente";
//  - o outro, ao pedir também, fecha o acordo;
//  - recusar, sair ou deixar o prazo passar encerra a oferta (não se reabre; para jogar de novo,
//    basta voltar ao saguão e convidar).
export class RematchOffer {
  private currentState: RematchState = "idle";
  private requestedBy: string | null = null;
  private expiresAt: number | null = null;
  private readonly ttlMs: number;

  constructor(
    private readonly playerIds: readonly [string, string],
    private readonly clock: Clock,
    ttlSeconds: number,
  ) {
    this.ttlMs = ttlSeconds * 1000;
  }

  status(): RematchStatus {
    if (this.currentState === "pending" && this.expiresAt !== null && this.clock.now() >= this.expiresAt) {
      this.currentState = "expired";
    }
    return { state: this.currentState, requestedBy: this.currentState === "pending" ? this.requestedBy : null, expiresAt: this.expiresAt };
  }

  /** O jogador quer a revanche (pedido novo ou aceite do pedido do adversário). */
  request(playerId: string): Result<RematchStatus, RematchProblem> {
    if (!this.playerIds.includes(playerId)) return fail("unknown_player");
    const { state } = this.status();
    if (state === "idle") {
      this.currentState = "pending";
      this.requestedBy = playerId;
      this.expiresAt = this.clock.now() + this.ttlMs;
    } else if (state === "pending") {
      if (this.requestedBy !== playerId) this.currentState = "agreed"; // o outro também quer
      // o mesmo jogador pedindo de novo não muda nada
    } else {
      return fail("closed");
    }
    return ok(this.status());
  }

  decline(playerId: string): Result<RematchStatus, RematchProblem> {
    if (!this.playerIds.includes(playerId)) return fail("unknown_player");
    const { state } = this.status();
    if (state !== "idle" && state !== "pending") return fail("closed");
    this.currentState = "declined";
    return ok(this.status());
  }

  /** Um dos jogadores saiu (fechou a partida ou perdeu a conexão): não há mais revanche. */
  cancel(): void {
    const { state } = this.status();
    if (state === "idle" || state === "pending") this.currentState = "cancelled";
  }
}
