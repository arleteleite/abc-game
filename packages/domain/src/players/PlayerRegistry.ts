import { fail, ok, type Result } from "../common/Result";
import type { IdGenerator } from "../ids/IdGenerator";
import type { Player } from "./Player";
import type { NicknameProblem, NicknameValidator } from "./NicknameValidator";

export type JoinProblem = NicknameProblem | "nickname_in_use";

// Quem está ativo agora. Garante apelido único entre ativos e identificador
// interno por jogador. Não guarda nada de quem saiu (PRD 10.5).
export class PlayerRegistry {
  private readonly byId = new Map<string, Player>();
  private readonly keys = new Map<string, string>(); // apelido normalizado -> id

  constructor(
    private readonly validator: NicknameValidator,
    private readonly ids: IdGenerator,
  ) {}

  join(nickname: string): Result<Player, JoinProblem> {
    const valid = this.validator.validate(nickname);
    if (!valid.ok) return valid;
    if (this.keys.has(valid.value.key)) return fail("nickname_in_use");

    const player: Player = { id: this.ids.next(), nickname: valid.value.display };
    this.byId.set(player.id, player);
    this.keys.set(valid.value.key, player.id);
    return ok(player);
  }

  /** Remove o jogador e libera o apelido para outra pessoa. */
  leave(playerId: string): void {
    const player = this.byId.get(playerId);
    if (!player) return;
    this.byId.delete(playerId);
    const valid = this.validator.validate(player.nickname);
    if (valid.ok) this.keys.delete(valid.value.key);
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
