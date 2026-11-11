import { DurableObject } from "cloudflare:workers";
import {
  DEFAULT_GAME_CONFIG,
  Lobby,
  NicknameValidator,
  PAWNS,
  PlayerRegistry,
  SystemClock,
  type LobbySnapshot,
  type Pawn,
  type Player,
} from "@abc-game/domain";
import type { AcceptRequest, InviteRequest, JoinRequest, JoinResponse, LobbyResponse, MatchCreatedResponse } from "@abc-game/protocol";
import type { Env } from "./env";
import { bearerToken, errorResponse, json, readJson } from "./http/json";
import { CryptoIdGenerator } from "./infra/CryptoIdGenerator";
import type { MatchInit } from "./matchInit";

const STORAGE_KEY = "state";
const config = DEFAULT_GAME_CONFIG;

const isPawn = (v: unknown): v is Pawn => typeof v === "string" && (PAWNS as readonly string[]).includes(v);

// O saguão (uma única instância): quem está online, a lista de disponíveis e os
// convites. Todas as regras estão na classe Lobby do domínio; aqui só há rede e
// armazenamento. Guarda o estado no disco do Durable Object porque ele pode ser
// descarregado da memória quando fica ocioso.
export class LobbyObject extends DurableObject<Env> {
  private readonly lobby: Lobby;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const registry = new PlayerRegistry(
      new NicknameValidator(config.nickname),
      new CryptoIdGenerator(),
      new CryptoIdGenerator(),
    );
    this.lobby = new Lobby(registry, new SystemClock(), new CryptoIdGenerator(), config.lobby, config.trail.invitationSeconds);
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<LobbySnapshot>(STORAGE_KEY);
      if (saved) this.lobby.restore(saved);
    });
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, "");
    const method = request.method;

    if (this.lobby.sweep().length > 0) await this.persist();

    if (method === "POST" && path === "/join") return this.join(request);
    // Rota interna: só as partidas (Durable Objects) a chamam, sem o prefixo /api.
    // Pela internet ela nunca é alcançada, porque o roteador só repassa /api/*.
    if (method === "POST" && path === "/internal/match-ended" && !url.pathname.startsWith("/api")) {
      return this.matchEnded(request);
    }

    // Rota interna usada pelo roteador do Quiz: confere o token e diz quem é o jogador.
    if (method === "POST" && path === "/internal/whoami" && !url.pathname.startsWith("/api")) {
      const who = bearerToken(request);
      const found = who ? this.lobby.authenticate(who) : undefined;
      return found ? json({ id: found.id, nickname: found.nickname }) : errorResponse("unauthorized", 401);
    }

    // Daqui em diante, o jogador precisa estar identificado pelo token.
    const token = bearerToken(request);
    const player = token ? this.lobby.authenticate(token) : undefined;
    if (!player) return errorResponse("unauthorized", 401);

    if (method === "GET" && path === "/lobby") return this.view(player);
    if (method === "POST" && path === "/leave") return this.leave(player);
    // Sinal de vida (menu e Quiz): authenticate já renovou a sessão.
    if (method === "POST" && path === "/heartbeat") return json({ ok: true });
    if (method === "POST" && path === "/invitations") return this.invite(request, player);

    const action = /^\/invitations\/([\w-]{1,64})\/(accept|decline|cancel)$/.exec(path);
    if (method === "POST" && action) {
      const [, id, verb] = action as unknown as [string, string, string];
      if (verb === "accept") return this.accept(request, player, id);
      if (verb === "decline") return this.respond(this.lobby.decline(id, player.id));
      return this.respond(this.lobby.cancel(id, player.id));
    }
    return errorResponse("not_found", 404);
  }

  // ---------- rotas ----------

  private async join(request: Request): Promise<Response> {
    const body = await readJson(request);
    if (!body || typeof body["nickname"] !== "string") return errorResponse("invalid_request", 400);
    const result = this.lobby.join((body as unknown as JoinRequest).nickname);
    if (!result.ok) return errorResponse(result.reason, result.reason === "nickname_in_use" ? 409 : 400);
    await this.persist();
    return json({ player: result.value.player, token: result.value.token } satisfies JoinResponse);
  }

  private view(player: Player): Response {
    const view = this.lobby.view(player.id);
    return json({ ...view, pollSeconds: config.lobby.pollSeconds } satisfies LobbyResponse);
  }

  private async leave(player: Player): Promise<Response> {
    this.lobby.leave(player.id);
    await this.persist();
    return json({ ok: true });
  }

  private async invite(request: Request, player: Player): Promise<Response> {
    const body = await readJson(request);
    if (!body || typeof body["toPlayerId"] !== "string" || !isPawn(body["pawn"])) return errorResponse("invalid_request", 400);
    const { toPlayerId, pawn } = body as unknown as InviteRequest;
    const result = this.lobby.invite(player.id, toPlayerId, pawn);
    if (!result.ok) return errorResponse(result.reason, 409);
    return json(result.value);
  }

  private async accept(request: Request, player: Player, invitationId: string): Promise<Response> {
    const body = await readJson(request);
    if (!body || !isPawn(body["pawn"])) return errorResponse("invalid_request", 400);
    const result = this.lobby.accept(invitationId, player.id, (body as unknown as AcceptRequest).pawn);
    if (!result.ok) return errorResponse(result.reason, 409);

    const { matchId, players } = result.value;
    const init: MatchInit = {
      matchId,
      players: players.map((p) => ({
        playerId: p.playerId,
        nickname: p.nickname,
        pawn: p.pawn,
        token: this.lobby.tokenOf(p.playerId) as string,
      })) as MatchInit["players"],
    };
    const stub = this.env.MATCH.get(this.env.MATCH.idFromName(matchId));
    const started = await stub.fetch("https://match/init", { method: "POST", body: JSON.stringify(init) });
    if (!started.ok) {
      // Não foi possível criar a partida (por exemplo, banco de perguntas vazio): libera os dois.
      this.lobby.finishMatch(matchId);
      await this.persist();
      return errorResponse("match_unavailable", 503);
    }
    await this.persist();
    return json({ matchId } satisfies MatchCreatedResponse);
  }

  private respond(result: { ok: true } | { ok: false; reason: string }): Response {
    return result.ok ? json({ ok: true }) : errorResponse(result.reason, 409);
  }

  private async matchEnded(request: Request): Promise<Response> {
    const body = await readJson(request);
    if (!body || typeof body["matchId"] !== "string") return errorResponse("invalid_request", 400);
    this.lobby.finishMatch(body["matchId"]);
    await this.persist();
    return json({ ok: true });
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put(STORAGE_KEY, this.lobby.snapshot());
  }
}
