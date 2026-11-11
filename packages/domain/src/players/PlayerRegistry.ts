import { fail, ok, type Result } from "../common/Result";
import type { IdGenerator } from "../ids/IdGenerator";
import type { Player } from "./Player";
import type { NicknameProblem, NicknameValidator } from "./NicknameValidator";

export type JoinProblem = NicknameProblem | "nickname_in_use";

/** Jogador + token secreto. O token só é entregue ao próprio jogador. */
export interface JoinedPlayer {
  player: Player;
  token: string;
}

// Quem está ativo agora. Garante apelido único entre ativos e identificador
// interno por jogador. Não guarda nada de quem saiu (PRD 10.5).
export class PlayerRegistry {
  private readonly byId = new Map<string, Player>();
  private readonly keys = new Map<string, string>(); // apelido normalizado -> id
  private readonly byToken = new Map<string, Player>();
  private readonly tokenOf = new Map<string, string>(); // id -> token

  constructor(
    private readonly validator: NicknameValidator,
    private readonly ids: IdGenerator,
    private readonly tokens: IdGenerator,
  ) {}

  join(nickname: string): Result<JoinedPlayer, JoinProblem> {
    const valid = this.validator.validate(nickname);
    if (!valid.ok) return valid;
    if (this.keys.has(valid.value.key)) return fail("nickname_in_use");

    const player: Player = { id: this.ids.next(), nickname: valid.value.display };
    const token = this.tokens.next();
    this.register(player, token, valid.value.key);
    return ok({ player, token });
  }

  /** Remove o jogador e libera o apelido para outra pessoa. */
  leave(playerId: string): void {
    const player = this.byId.get(playerId);
    if (!player) return;
    this.byId.delete(playerId);
    const token = this.tokenOf.get(playerId);
    if (token) this.byToken.delete(token);
    this.tokenOf.delete(playerId);
    const valid = this.validator.validate(player.nickname);
    if (valid.ok) this.keys.delete(valid.value.key);
  }

  /** Descobre quem é o dono do token (usado em toda requisição do jogador). */
  authenticate(token: string): Player | undefined {
    return this.byToken.get(token);
  }

  /** Token do jogador (uso interno do servidor, para repassar à partida). */
  tokenFor(playerId: string): string | undefined {
    return this.tokenOf.get(playerId);
  }

  /** Para guardar o estado entre uma requisição e outra (o servidor pode ser descarregado). */
  snapshot(): JoinedPlayer[] {
    return [...this.byId.values()].map((player) => ({ player, token: this.tokenOf.get(player.id) as string }));
  }

  restore(entries: readonly JoinedPlayer[]): void {
    for (const { player, token } of entries) {
      const valid = this.validator.validate(player.nickname);
      if (valid.ok) this.register(player, token, valid.value.key);
    }
  }

  private register(player: Player, token: string, key: string): void {
    this.byId.set(player.id, player);
    this.keys.set(key, player.id);
    this.byToken.set(token, player);
    this.tokenOf.set(player.id, token);
  }

  get(playerId: string): Player | undefined {
    return this.byId.get(playerId);
  }

  isActive(playerId: string): boolean {
    return this.byId.has(playerId);
  }

  list(): Player[] {
    return [...this.byId.values()];
  }
}
