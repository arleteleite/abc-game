import { fail, ok, type Result } from "../common/Result";
import type { Clock } from "../time/Clock";
import type { Pawn } from "../board/PlayerPiece";

export type InvitationState = "created" | "accepted" | "declined" | "expired" | "canceled";
export type InvitationProblem =
  | "not_available" // já aceito, recusado, cancelado ou expirado
  | "expired"
  | "own_invitation"
  | "not_invited" // convite direcionado a outra pessoa
  | "same_pawn"
  | "not_sender";

// Convite da Trilha (PRD 7.1). Vale para convite pela lista (tem destinatário)
// e para link de WhatsApp (sem destinatário; o primeiro a aceitar fica com ele).
// Uso único: depois de aceito, recusado ou cancelado, não aceita mais nada.
export class Invitation {
  private currentState: InvitationState = "created";
  private acceptedBy: string | null = null;
  private acceptedPawn: Pawn | null = null;
  readonly expiresAt: number;

  constructor(
    readonly id: string,
    readonly fromPlayerId: string,
    readonly fromPawn: Pawn,
    /** Destinatário do convite pela lista; null = link aberto. */
    readonly toPlayerId: string | null,
    private readonly clock: Clock,
    ttlSeconds: number,
  ) {
    this.expiresAt = clock.now() + ttlSeconds * 1000;
  }

  /** Estado atual; um convite não usado vira "expired" ao passar do prazo. */
  get state(): InvitationState {
    if (this.currentState === "created" && this.clock.now() >= this.expiresAt) {
      this.currentState = "expired";
    }
    return this.currentState;
  }

  get guest(): { playerId: string; pawn: Pawn } | null {
    return this.acceptedBy && this.acceptedPawn ? { playerId: this.acceptedBy, pawn: this.acceptedPawn } : null;
  }

  accept(playerId: string, pawn: Pawn): Result<{ playerId: string; pawn: Pawn }, InvitationProblem> {
    const state = this.state;
    if (state === "expired") return fail("expired");
    if (state !== "created") return fail("not_available");
    if (playerId === this.fromPlayerId) return fail("own_invitation");
    if (this.toPlayerId !== null && this.toPlayerId !== playerId) return fail("not_invited");
    if (pawn === this.fromPawn) return fail("same_pawn");

    this.currentState = "accepted";
    this.acceptedBy = playerId;
    this.acceptedPawn = pawn;
    return ok({ playerId, pawn });
  }

  decline(playerId: string): Result<void, InvitationProblem> {
    const state = this.state;
    if (state === "expired") return fail("expired");
    if (state !== "created") return fail("not_available");
    if (this.toPlayerId === null || this.toPlayerId !== playerId) return fail("not_invited");
    this.currentState = "declined";
    return ok(undefined);
  }

  cancel(playerId: string): Result<void, InvitationProblem> {
    if (playerId !== this.fromPlayerId) return fail("not_sender");
    if (this.state !== "created") return fail("not_available");
    this.currentState = "canceled";
    return ok(undefined);
  }
}
