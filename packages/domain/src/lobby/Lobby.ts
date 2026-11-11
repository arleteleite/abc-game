import { fail, ok, type Result } from "../common/Result";
import type { Pawn } from "../board/PlayerPiece";
import type { LobbyConfig } from "../config/GameConfig";
import type { IdGenerator } from "../ids/IdGenerator";
import { Invitation, type InvitationProblem, type InvitationState } from "../invitations/Invitation";
import type { Player } from "../players/Player";
import type { JoinedPlayer, JoinProblem, PlayerRegistry } from "../players/PlayerRegistry";
import type { Clock } from "../time/Clock";

export type InviteProblem =
  | "unknown_player"
  | "self_invite"
  | "player_busy"
  | "target_unavailable";

export type RespondProblem = InvitationProblem | "unknown_invitation" | "unknown_player" | "player_busy" | "sender_gone";

export interface InvitationView {
  id: string;
  fromPlayerId: string;
  fromNickname: string;
  fromPawn: Pawn;
  toPlayerId: string | null;
  state: InvitationState;
  expiresAt: number;
}

/** Tudo o que a tela do lobby de UM jogador precisa. */
export interface LobbyView {
  /** Outros jogadores livres, que podem receber convite. */
  available: Player[];
  incoming: InvitationView[];
  /** Último convite enviado por mim; quando termina (recusado, expirado...) é entregue uma vez e some. */
  outgoing: InvitationView | null;
  /** Se já estou numa partida, o identificador dela. */
  matchId: string | null;
}

export interface MatchSetup {
  matchId: string;
  players: [
    { playerId: string; nickname: string; pawn: Pawn },
    { playerId: string; nickname: string; pawn: Pawn },
  ];
}

/** Estado que o servidor guarda entre uma requisição e outra (pode ser descarregado da memória). */
export interface LobbySnapshot {
  players: JoinedPlayer[];
  matches: Array<{ matchId: string; startedAt: number; playerIds: string[] }>;
}

// O "saguão": quem está online, quem está livre, e os convites entre jogadores.
// Não sabe de rede nem de armazenamento (o Worker guarda o que for preciso).
export class Lobby {
  private readonly lastSeen = new Map<string, number>(); // qualquer sinal de vida (mantém a sessão)
  private readonly lastInLobby = new Map<string, number>(); // última consulta ao saguão (aparece na lista)
  private readonly inMatch = new Map<string, string>(); // playerId -> matchId
  private readonly matchStartedAt = new Map<string, number>(); // matchId -> início
  private readonly invitations = new Map<string, Invitation>();
  private readonly deliveredTerminal = new Set<string>();

  constructor(
    private readonly registry: PlayerRegistry,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly config: LobbyConfig,
    private readonly invitationSeconds: number,
  ) {}

  // ---------- guardar e restaurar ----------

  snapshot(): LobbySnapshot {
    const matches = new Map<string, { matchId: string; startedAt: number; playerIds: string[] }>();
    for (const [playerId, matchId] of this.inMatch) {
      const entry = matches.get(matchId) ?? { matchId, startedAt: this.matchStartedAt.get(matchId) ?? 0, playerIds: [] };
      entry.playerIds.push(playerId);
      matches.set(matchId, entry);
    }
    return { players: this.registry.snapshot(), matches: [...matches.values()] };
  }

  /** Quem volta de uma restauração conta como "visto agora" (ganha um novo prazo). */
  restore(snapshot: LobbySnapshot): void {
    this.registry.restore(snapshot.players);
    for (const { player } of snapshot.players) this.lastSeen.set(player.id, this.clock.now());
    for (const match of snapshot.matches) {
      this.matchStartedAt.set(match.matchId, match.startedAt);
      for (const playerId of match.playerIds) this.inMatch.set(playerId, match.matchId);
    }
  }

  // ---------- entrada e saída ----------

  join(nickname: string): Result<JoinedPlayer, JoinProblem> {
    const result = this.registry.join(nickname);
    if (result.ok) this.lastSeen.set(result.value.player.id, this.clock.now());
    return result;
  }

  /** Descobre o jogador pelo token e registra que ele está vivo. */
  authenticate(token: string): Player | undefined {
    const player = this.registry.authenticate(token);
    if (player) this.lastSeen.set(player.id, this.clock.now());
    return player;
  }

  leave(playerId: string): void {
    for (const invitation of this.invitations.values()) {
      if (invitation.fromPlayerId === playerId) invitation.cancel(playerId);
    }
    this.inMatch.delete(playerId);
    this.lastSeen.delete(playerId);
    this.lastInLobby.delete(playerId);
    this.registry.leave(playerId);
  }

  /** Remove quem ficou sem sinal de vida e não está numa partida. Devolve os removidos. */
  sweep(): string[] {
    // Partida que nunca avisou o fim (servidor reiniciado, por exemplo): libera os jogadores.
    for (const [matchId, startedAt] of this.matchStartedAt) {
      if (this.clock.now() - startedAt >= this.config.matchMaxSeconds * 1000) this.finishMatch(matchId);
    }

    const limit = this.config.presenceTimeoutSeconds * 1000;
    const removed: string[] = [];
    for (const player of this.registry.list()) {
      if (this.inMatch.has(player.id)) continue;
      const seen = this.lastSeen.get(player.id) ?? 0;
      if (this.clock.now() - seen >= limit) {
        this.leave(player.id);
        removed.push(player.id);
      }
    }
    // Limpa convites já encerrados e entregues.
    for (const [id, invitation] of this.invitations) {
      if (invitation.state === "accepted" || (invitation.state !== "created" && this.deliveredTerminal.has(id))) {
        this.invitations.delete(id);
        this.deliveredTerminal.delete(id);
      }
    }
    return removed;
  }

  // ---------- consulta ----------

  /** Sinal de vida sem fazer mais nada (usado pelo menu e pelo Quiz). */
  heartbeat(playerId: string): void {
    if (this.registry.isActive(playerId)) this.lastSeen.set(playerId, this.clock.now());
  }

  view(playerId: string): LobbyView {
    // Quem consulta o saguão está nele: aparece para os outros por um tempo curto.
    this.lastInLobby.set(playerId, this.clock.now());
    const available = this.registry
      .list()
      .filter((p) => p.id !== playerId && !this.inMatch.has(p.id) && this.isVisible(p.id));

    const incoming: InvitationView[] = [];
    let outgoing: InvitationView | null = null;
    for (const [id, invitation] of this.invitations) {
      if (invitation.fromPlayerId === playerId) {
        const view = this.toView(invitation);
        if (view && invitation.state === "created") {
          outgoing = view;
        } else if (view && !this.deliveredTerminal.has(id) && invitation.state !== "accepted") {
          outgoing = outgoing ?? view; // recusado/expirado/cancelado: entrega uma vez
          this.deliveredTerminal.add(id);
        }
      } else if (invitation.state === "created" && invitation.toPlayerId === playerId) {
        const view = this.toView(invitation);
        if (view) incoming.push(view);
      }
    }
    return { available, incoming, outgoing, matchId: this.inMatch.get(playerId) ?? null };
  }

  /** Token do jogador, só para o servidor repassar à partida (nunca vai para outro jogador). */
  tokenOf(playerId: string): string | undefined {
    return this.registry.tokenFor(playerId);
  }

  matchOf(playerId: string): string | null {
    return this.inMatch.get(playerId) ?? null;
  }

  // ---------- convites ----------

  invite(fromId: string, toId: string, pawn: Pawn): Result<InvitationView, InviteProblem> {
    const from = this.registry.get(fromId);
    if (!from) return fail("unknown_player");
    if (fromId === toId) return fail("self_invite");
    if (this.inMatch.has(fromId)) return fail("player_busy");
    const to = this.registry.get(toId);
    if (!to || this.inMatch.has(toId) || !this.isVisible(toId)) return fail("target_unavailable");

    this.cancelOpenInvitationsFrom(fromId);
    const invitation = new Invitation(this.ids.next(), fromId, pawn, toId, this.clock, this.invitationSeconds);
    this.invitations.set(invitation.id, invitation);
    return ok(this.toView(invitation) as InvitationView);
  }

  accept(invitationId: string, playerId: string, pawn: Pawn): Result<MatchSetup, RespondProblem> {
    const invitation = this.invitations.get(invitationId);
    if (!invitation) return fail("unknown_invitation");
    const guest = this.registry.get(playerId);
    if (!guest) return fail("unknown_player");
    const host = this.registry.get(invitation.fromPlayerId);
    if (!host) return fail("sender_gone");
    if (this.inMatch.has(playerId)) return fail("player_busy");
    if (this.inMatch.has(host.id)) return fail("sender_gone");

    const accepted = invitation.accept(playerId, pawn);
    if (!accepted.ok) return accepted;

    const matchId = this.ids.next();
    this.matchStartedAt.set(matchId, this.clock.now());
    this.inMatch.set(host.id, matchId);
    this.inMatch.set(guest.id, matchId);
    // Os dois entraram numa partida: convites pendentes dos dois perdem o sentido.
    this.cancelOpenInvitationsFrom(host.id);
    this.cancelOpenInvitationsFrom(guest.id);
    this.cancelOpenInvitationsTo(host.id);
    this.cancelOpenInvitationsTo(guest.id);

    return ok({
      matchId,
      players: [
        { playerId: host.id, nickname: host.nickname, pawn: invitation.fromPawn },
        { playerId: guest.id, nickname: guest.nickname, pawn },
      ],
    });
  }

  decline(invitationId: string, playerId: string): Result<void, RespondProblem> {
    const invitation = this.invitations.get(invitationId);
    if (!invitation) return fail("unknown_invitation");
    return invitation.decline(playerId);
  }

  cancel(invitationId: string, playerId: string): Result<void, RespondProblem> {
    const invitation = this.invitations.get(invitationId);
    if (!invitation) return fail("unknown_invitation");
    return invitation.cancel(playerId);
  }

  // ---------- partidas ----------

  /** A partida terminou: os jogadores voltam a ficar disponíveis. */
  finishMatch(matchId: string): void {
    this.matchStartedAt.delete(matchId);
    for (const [playerId, id] of this.inMatch) {
      if (id === matchId) {
        this.inMatch.delete(playerId);
        this.lastSeen.set(playerId, this.clock.now());
      }
    }
  }

  // ---------- internos ----------

  /** Está no saguão agora: consultou a lista há pouco e não está jogando. */
  private isVisible(playerId: string): boolean {
    const seen = this.lastInLobby.get(playerId);
    return seen !== undefined && this.clock.now() - seen < this.config.visibleSeconds * 1000;
  }

  private cancelOpenInvitationsFrom(playerId: string): void {
    for (const invitation of this.invitations.values()) {
      if (invitation.fromPlayerId === playerId && invitation.state === "created") invitation.cancel(playerId);
    }
  }

  private cancelOpenInvitationsTo(playerId: string): void {
    for (const invitation of this.invitations.values()) {
      if (invitation.toPlayerId === playerId && invitation.state === "created") {
        invitation.cancel(invitation.fromPlayerId);
      }
    }
  }

  private toView(invitation: Invitation): InvitationView | null {
    const from = this.registry.get(invitation.fromPlayerId);
    if (!from) return null;
    return {
      id: invitation.id,
      fromPlayerId: from.id,
      fromNickname: from.nickname,
      fromPawn: invitation.fromPawn,
      toPlayerId: invitation.toPlayerId,
      state: invitation.state,
      expiresAt: invitation.expiresAt,
    };
  }
}
