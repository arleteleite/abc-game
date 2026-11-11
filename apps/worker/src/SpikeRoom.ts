import { DurableObject } from "cloudflare:workers";

// SPIKE (etapa 2): sala de teste. Prova três coisas: Durable Object com SQLite,
// WebSocket com hibernação e reconexão pelo identificador do jogador.
// Não é o servidor final da Trilha (etapa 5).

interface Env {
  SPIKE_ROOM: DurableObjectNamespace<SpikeRoom>;
}

interface GameState {
  players: string[]; // até 2 identificadores, na ordem de entrada
  turn: number; // índice em players
  moves: number;
}

interface Attachment {
  playerId: string | null;
}

type ClientMessage =
  | { type: "join"; playerId: string }
  | { type: "ping"; t: number }
  | { type: "move" }
  | { type: "reset" };

export class SpikeRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS state (k TEXT PRIMARY KEY, v TEXT NOT NULL)",
    );
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/stats")) {
      return Response.json({
        connections: this.ctx.getWebSockets().length,
        game: this.loadGame(),
      });
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Esperava WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    // acceptWebSocket usa a API de hibernação: o objeto pode ser descarregado
    // da memória entre mensagens sem derrubar a conexão (não cobra duração).
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId: null } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  override webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): void {
    const msg = this.parse(raw);
    if (!msg) {
      this.send(ws, { type: "error", reason: "mensagem_invalida" });
      return;
    }
    switch (msg.type) {
      case "ping":
        this.send(ws, { type: "pong", t: msg.t, server: Date.now() });
        return;
      case "join":
        this.handleJoin(ws, msg.playerId);
        return;
      case "move":
        this.handleMove(ws);
        return;
      case "reset":
        this.saveGame({ players: [], turn: 0, moves: 0 });
        this.broadcast({ type: "state", game: this.loadGame() });
        return;
    }
  }

  override webSocketClose(ws: WebSocket, code: number, reason: string): void {
    // Responder ao fechamento do cliente; o estado do jogo fica no SQLite.
    ws.close(code, reason);
  }

  private handleJoin(ws: WebSocket, playerId: string): void {
    // Reconexão: se o mesmo jogador já tem outra conexão, a antiga é encerrada.
    for (const other of this.ctx.getWebSockets()) {
      if (other === ws) continue;
      const att = other.deserializeAttachment() as Attachment | null;
      if (att?.playerId === playerId) other.close(4000, "substituida");
    }
    ws.serializeAttachment({ playerId } satisfies Attachment);

    const game = this.loadGame();
    if (!game.players.includes(playerId) && game.players.length < 2) {
      game.players.push(playerId);
      this.saveGame(game);
    }
    this.send(ws, { type: "joined", playerId, game: this.loadGame() });
    this.broadcast({ type: "state", game: this.loadGame() });
  }

  private handleMove(ws: WebSocket): void {
    const att = ws.deserializeAttachment() as Attachment | null;
    const game = this.loadGame();
    const index = att?.playerId ? game.players.indexOf(att.playerId) : -1;
    if (index === -1) {
      this.send(ws, { type: "error", reason: "nao_esta_na_partida" });
      return;
    }
    if (game.players.length < 2) {
      this.send(ws, { type: "error", reason: "aguardando_adversario" });
      return;
    }
    if (index !== game.turn) {
      this.send(ws, { type: "error", reason: "fora_de_turno" });
      return;
    }
    game.moves += 1;
    game.turn = 1 - game.turn;
    this.saveGame(game);
    this.broadcast({ type: "state", game });
  }

  private parse(raw: string | ArrayBuffer): ClientMessage | null {
    if (typeof raw !== "string") return null;
    try {
      const data = JSON.parse(raw) as { type?: string };
      switch (data.type) {
        case "join":
          return typeof (data as { playerId?: unknown }).playerId === "string"
            ? (data as ClientMessage)
            : null;
        case "ping":
          return typeof (data as { t?: unknown }).t === "number"
            ? (data as ClientMessage)
            : null;
        case "move":
        case "reset":
          return data as ClientMessage;
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  private loadGame(): GameState {
    const row = this.ctx.storage.sql
      .exec<{ v: string }>("SELECT v FROM state WHERE k = 'game'")
      .toArray()[0];
    return row ? (JSON.parse(row.v) as GameState) : { players: [], turn: 0, moves: 0 };
  }

  private saveGame(game: GameState): void {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO state (k, v) VALUES ('game', ?)",
      JSON.stringify(game),
    );
  }

  private send(ws: WebSocket, data: unknown): void {
    ws.send(JSON.stringify(data));
  }

  private broadcast(data: unknown): void {
    const text = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) ws.send(text);
  }
}
