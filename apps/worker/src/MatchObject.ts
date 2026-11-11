import { DurableObject } from "cloudflare:workers";
import {
  AnswerShuffler,
  Board,
  DEFAULT_GAME_CONFIG,
  ListShuffler,
  MathRandom,
  Match,
  PlayerPiece,
  RematchOffer,
  QuestionSelector,
  SystemClock,
  TrailLevelPicker,
  TrailQuestionDealer,
  type AnswerOutcome,
  type MatchResult,
  type RaceOutcome,
  type RacePrompt,
  type TickResult,
  type TurnPrompt,
} from "@abc-game/domain";
import { parseClientMessage, type PlayerInfo, type ServerMessage } from "@abc-game/protocol";
import type { Env } from "./env";
import { errorResponse, json, readJson } from "./http/json";
import { D1TrailResultRepository } from "./infra/D1TrailResultRepository";
import { getQuestionBank } from "./infra/questionBank";
import type { MatchInit, MatchInitPlayer } from "./matchInit";

const config = DEFAULT_GAME_CONFIG.trail;

// Uma partida da Trilha. A regra toda está na classe Match do domínio; aqui só
// há WebSocket, relógio periódico e envio de mensagens. Usa WebSocket "comum"
// (não hibernante) de propósito: a partida está na memória e dura poucos minutos,
// então o objeto precisa continuar vivo enquanto os jogadores estão conectados.
export class MatchObject extends DurableObject<Env> {
  private match: Match | null = null;
  private matchId = "";
  private players: MatchInitPlayer[] = [];
  private readonly sockets = new Map<string, WebSocket>();
  private clock = new SystemClock();
  private timer: ReturnType<typeof setInterval> | null = null;
  private raceStarted = false;
  private lastRacePrompt: RacePrompt | null = null;
  private lastTurnPrompt: TurnPrompt | null = null;
  private endHandled = false;
  private offer: RematchOffer | null = null;

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/init" && url.hostname === "match") return this.init(request);
    if (request.headers.get("Upgrade") === "websocket") return this.acceptSocket(url);
    return errorResponse("not_found", 404);
  }

  // ---------- criação ----------

  private async init(request: Request): Promise<Response> {
    if (this.match) return errorResponse("already_started", 409);
    const body = (await readJson(request)) as unknown as MatchInit | null;
    if (!body || !Array.isArray(body.players) || body.players.length !== 2) return errorResponse("invalid_request", 400);

    try {
      const random = new MathRandom();
      const shuffler = new ListShuffler(random);
      const selector = new QuestionSelector(getQuestionBank(), shuffler);
      const dealer = new TrailQuestionDealer(selector, new TrailLevelPicker(config, shuffler));
      this.matchId = body.matchId;
      this.players = body.players;
      this.match = new Match({
        config,
        board: new Board(config),
        players: [
          new PlayerPiece(body.players[0].playerId, body.players[0].pawn),
          new PlayerPiece(body.players[1].playerId, body.players[1].pawn),
        ],
        dealer,
        presenter: new AnswerShuffler(shuffler),
        random,
        clock: this.clock,
        ...(body.isRematch ? { isRematch: true } : {}),
      });
      // Os dois ainda não conectaram: quem não aparecer dentro da tolerância é abandono.
      for (const p of this.players) this.match.playerDisconnected(p.playerId);
      this.timer = setInterval(() => this.onTick(), 1000);
      return json({ ok: true });
    } catch {
      this.match = null;
      return errorResponse("match_unavailable", 503);
    }
  }

  // ---------- conexão ----------

  private acceptSocket(url: URL): Response {
    const match = this.match;
    const token = url.searchParams.get("token") ?? "";
    const me = this.players.find((p) => p.token === token);
    if (!match || !me) return errorResponse("unauthorized", 401);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    // Reconexão: a conexão antiga do mesmo jogador é substituída.
    this.sockets.get(me.playerId)?.close(4000, "replaced");
    const reconnected = match.playerReconnected(me.playerId);
    if (!reconnected) {
      server.send(JSON.stringify({ type: "error", reason: "tolerance_expired" } satisfies ServerMessage));
      server.close(4001, "tolerance_expired");
      return new Response(null, { status: 101, webSocket: client });
    }

    this.sockets.set(me.playerId, server);
    server.addEventListener("message", (ev) => this.onMessage(me.playerId, ev.data));
    server.addEventListener("close", () => this.onClose(me.playerId, server));
    server.addEventListener("error", () => this.onClose(me.playerId, server));

    this.greet(me);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Conta ao jogador quem é, e retoma do ponto em que a partida está. */
  private greet(me: MatchInitPlayer): void {
    const match = this.match as Match;
    const opponent = this.opponentOf(me.playerId);
    this.sendTo(me.playerId, {
      type: "welcome",
      you: this.info(me),
      opponent: this.info(opponent),
      boardSize: config.boardSize,
    });
    this.broadcastOpponentStatus(me.playerId, true);

    if (match.phase === "finished") {
      this.sendEnd(me.playerId);
      this.sendTo(me.playerId, this.rematchMessage());
      return;
    }
    const bothHere = this.sockets.size === 2;
    if (!this.raceStarted) {
      if (!bothHere) {
        this.sendTo(me.playerId, { type: "waiting_opponent" });
        return;
      }
      this.raceStarted = true;
      this.lastRacePrompt = match.beginRace();
      this.broadcast((id) => this.raceMessage(id));
      return;
    }
    // Retomada após reconexão
    this.sendState(me.playerId);
    if (match.phase === "race" && this.lastRacePrompt) {
      this.sendTo(me.playerId, this.raceMessage());
    } else if (match.phase === "playing" && this.lastTurnPrompt) {
      this.sendTurnPrompt(this.lastTurnPrompt, me.playerId);
    }
  }

  // ---------- mensagens do jogador ----------

  private onMessage(playerId: string, data: unknown): void {
    const match = this.match;
    const message = parseClientMessage(data);
    if (!match || !message) {
      this.sendTo(playerId, { type: "error", reason: "invalid_message" });
      return;
    }
    switch (message.type) {
      case "ping":
        this.sendTo(playerId, { type: "pong", t: message.t });
        return;
      case "leave":
        match.leave(playerId);
        this.afterChange();
        return;
      case "rematch_request":
      case "rematch_decline": {
        if (!this.offer || match.phase !== "finished") {
          this.sendTo(playerId, { type: "error", reason: "rematch_unavailable" });
          return;
        }
        const res = message.type === "rematch_request" ? this.offer.request(playerId) : this.offer.decline(playerId);
        if (!res.ok) {
          this.sendTo(playerId, { type: "error", reason: `rematch_${res.reason}` });
          return;
        }
        this.broadcast(() => this.rematchMessage());
        if (res.value.state === "agreed") this.ctx.waitUntil(this.launchRematch());
        else this.stopTimerIfOfferClosed();
        return;
      }
      case "race_answer": {
        const res = match.submitRaceAnswer(playerId, message.questionId, message.choice);
        if (!res.ok) this.sendTo(playerId, { type: "error", reason: res.reason });
        else this.applyRaceOutcome(playerId, res.value);
        this.afterChange();
        return;
      }
      case "answer": {
        const res = match.submitAnswer(playerId, message.questionId, message.choice);
        if (!res.ok) this.sendTo(playerId, { type: "error", reason: res.reason });
        else this.applyAnswerOutcome(res.value);
        this.afterChange();
        return;
      }
    }
  }

  private onClose(playerId: string, socket: WebSocket): void {
    if (this.sockets.get(playerId) !== socket) return; // já foi substituída por reconexão
    this.sockets.delete(playerId);
    const match = this.match;
    if (match?.phase === "finished") {
      // Quem sai da tela de resultado desfaz a oferta de revanche (o outro é avisado).
      if (this.offer && ["idle", "pending"].includes(this.offer.status().state)) {
        this.offer.cancel();
        this.broadcast(() => this.rematchMessage());
        this.stopTimerIfOfferClosed();
      }
      return;
    }
    if (!match) return;
    match.playerDisconnected(playerId);
    this.sendTo(this.opponentOf(playerId).playerId, {
      type: "opponent_status",
      connected: false,
      graceMs: config.reconnectToleranceSeconds * 1000,
    });
  }

  // ---------- relógio ----------

  private onTick(): void {
    const match = this.match;
    if (!match) return;
    if (match.phase === "finished") {
      // Só resta vigiar o prazo da revanche.
      if (this.offer && this.offer.status().state === "expired") this.broadcast(() => this.rematchMessage());
      this.stopTimerIfOfferClosed();
      return;
    }
    const tick: TickResult | null = match.tick();
    if (tick?.kind === "race_expired") this.applyRaceOutcome(null, tick.outcome);
    if (tick?.kind === "turn_expired") this.applyAnswerOutcome(tick.outcome);
    this.afterChange();
  }

  // ---------- efeitos das regras ----------

  private applyRaceOutcome(answeringPlayerId: string | null, outcome: RaceOutcome): void {
    if (outcome.status === "waiting") {
      if (answeringPlayerId) this.sendTo(answeringPlayerId, { type: "race_waiting" });
      return;
    }
    if (outcome.status === "retry") {
      this.lastRacePrompt = outcome.prompt;
      this.broadcast((id) => this.raceMessage(id));
      return;
    }
    this.lastRacePrompt = null;
    this.broadcast(() => ({ type: "race_decided", starter: outcome.starter, reason: outcome.reason }));
    this.dispatchTurn(outcome.prompt);
  }

  private applyAnswerOutcome(outcome: AnswerOutcome): void {
    this.broadcast(() => ({
      type: "answer_result",
      playerId: outcome.playerId,
      correct: outcome.correct,
      timedOut: outcome.timedOut,
      correctKey: outcome.correctKey,
      move: outcome.move,
      skippedPlayerIds: outcome.skippedPlayerIds,
    }));
    this.broadcast((id) => this.stateMessage(id));
    if (outcome.next) this.dispatchTurn(outcome.next);
  }

  /** A pergunta vai SÓ para o jogador da vez; o adversário só sabe de quem é a vez. */
  private dispatchTurn(prompt: TurnPrompt): void {
    this.lastTurnPrompt = prompt;
    this.broadcast((id) => this.stateMessage(id));
    for (const p of this.players) this.sendTurnPrompt(prompt, p.playerId);
  }

  private sendTurnPrompt(prompt: TurnPrompt, toPlayerId: string): void {
    const remainingMs = Math.max(0, prompt.deadlineAt - this.clock.now());
    this.sendTo(
      toPlayerId,
      prompt.playerId === toPlayerId
        ? { type: "turn_question", question: prompt.question, remainingMs }
        : { type: "opponent_turn", playerId: prompt.playerId, remainingMs },
    );
  }

  /** Depois de qualquer mudança: se a partida acabou, avisa, grava e libera os jogadores. */
  private afterChange(): void {
    const match = this.match;
    if (!match || match.phase !== "finished" || this.endHandled) return;
    this.endHandled = true;
    const result = match.result as MatchResult;
    // Revanche só faz sentido se os dois ainda estão por aqui: abandono não tem revanche.
    if (result.endReason !== "abandoned") {
      const [first, second] = this.players as [MatchInitPlayer, MatchInitPlayer];
      this.offer = new RematchOffer([first.playerId, second.playerId], this.clock, config.invitationSeconds);
    } else {
      this.stopTimer();
    }
    for (const p of this.players) {
      this.sendEnd(p.playerId);
      this.sendTo(p.playerId, this.rematchMessage());
    }
    this.ctx.waitUntil(this.finalize(result));
  }

  // ---------- revanche ----------

  private rematchMessage(): ServerMessage {
    if (!this.offer) return { type: "rematch_status", state: "unavailable", requestedBy: null, expiresInMs: null };
    const status = this.offer.status();
    return {
      type: "rematch_status",
      state: status.state,
      requestedBy: status.requestedBy,
      expiresInMs: status.expiresAt === null ? null : Math.max(0, status.expiresAt - this.clock.now()),
    };
  }

  /** Os dois aceitaram: o saguão cria a partida nova (mesmos jogadores e peões) e avisa o caminho. */
  private async launchRematch(): Promise<void> {
    this.stopTimer();
    try {
      const [first, second] = this.players as [MatchInitPlayer, MatchInitPlayer];
      const lobby = this.env.LOBBY.get(this.env.LOBBY.idFromName("main"));
      const response = await lobby.fetch("https://lobby/internal/rematch", {
        method: "POST",
        body: JSON.stringify({
          first: { playerId: first.playerId, pawn: first.pawn },
          second: { playerId: second.playerId, pawn: second.pawn },
          previousMatchId: this.matchId,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const { matchId } = (await response.json()) as { matchId: string };
      this.broadcast(() => ({ type: "rematch_started", matchId }));
    } catch {
      // Um dos dois já entrou em outra partida, ou a partida não pôde ser criada.
      this.broadcast(() => ({ type: "rematch_status", state: "unavailable", requestedBy: null, expiresInMs: null }));
    }
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** O relógio de 1 s só continua enquanto a oferta de revanche pode expirar. */
  private stopTimerIfOfferClosed(): void {
    const state = this.offer?.status().state;
    if (!this.offer || (state !== "idle" && state !== "pending")) this.stopTimer();
  }

  private async finalize(result: MatchResult): Promise<void> {
    if (result.rankable && result.winnerId && result.winnerTotalAnswerMs !== null) {
      const winner = this.players.find((p) => p.playerId === result.winnerId) as MatchInitPlayer;
      const loser = this.opponentOf(winner.playerId);
      await new D1TrailResultRepository(this.env.DB).save({
        matchId: this.matchId,
        winnerNickname: winner.nickname,
        loserNickname: loser.nickname,
        winnerTotalAnswerMs: result.winnerTotalAnswerMs,
        endedAt: this.clock.now(),
      });
    }
    const lobby = this.env.LOBBY.get(this.env.LOBBY.idFromName("main"));
    await lobby.fetch("https://lobby/internal/match-ended", {
      method: "POST",
      body: JSON.stringify({ matchId: this.matchId }),
    });
  }

  // ---------- montagem das mensagens ----------

  private raceMessage(_forPlayerId?: string): ServerMessage {
    const prompt = this.lastRacePrompt as RacePrompt;
    return {
      type: "race_question",
      question: prompt.question,
      attempt: prompt.attempt,
      remainingMs: Math.max(0, prompt.deadlineAt - this.clock.now()),
    };
  }

  private stateMessage(_forPlayerId?: string): ServerMessage {
    const snap = (this.match as Match).snapshot();
    return { type: "state", currentPlayerId: snap.currentPlayerId, players: snap.players };
  }

  private sendState(playerId: string): void {
    this.sendTo(playerId, this.stateMessage());
  }

  private sendEnd(playerId: string): void {
    const result = (this.match as Match).result as MatchResult;
    const winner = this.players.find((p) => p.playerId === result.winnerId);
    const match = this.match as Match;
    const positions = match.snapshot().players;
    const finalStats = match.playerStats().map((s) => ({
      ...s,
      position: positions.find((p) => p.playerId === s.playerId)?.position ?? 0,
    }));
    this.sendTo(playerId, { type: "match_ended", result, winnerNickname: winner?.nickname ?? null, finalStats });
  }

  private broadcastOpponentStatus(joiningPlayerId: string, connected: boolean): void {
    this.sendTo(this.opponentOf(joiningPlayerId).playerId, { type: "opponent_status", connected, graceMs: 0 });
  }

  private info(p: MatchInitPlayer): PlayerInfo {
    return { id: p.playerId, nickname: p.nickname, pawn: p.pawn };
  }

  private opponentOf(playerId: string): MatchInitPlayer {
    return this.players.find((p) => p.playerId !== playerId) as MatchInitPlayer;
  }

  private broadcast(build: (playerId: string) => ServerMessage): void {
    for (const p of this.players) this.sendTo(p.playerId, build(p.playerId));
  }

  private sendTo(playerId: string, message: ServerMessage): void {
    const socket = this.sockets.get(playerId);
    if (!socket) return;
    try {
      socket.send(JSON.stringify(message));
    } catch {
      // conexão já caiu; o evento "close" cuida do resto
    }
  }
}
