import type { ClientMessage, ServerMessage } from "@abc-game/protocol";

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "closed";

interface Handlers {
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
}

const RETRY_MS = 1000;
const GIVE_UP_AFTER_MS = 40_000; // a tolerância do servidor é 30 s
const KEEPALIVE_MS = 20_000;

// Conexão WebSocket com a partida. Se a rede cair (4G!), tenta voltar sozinha
// com o mesmo token; o servidor retoma a partida de onde estava.
export class MatchConnection {
  private socket: WebSocket | null = null;
  private stopped = false;
  private droppedAt: number | null = null;
  private keepAlive: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly matchId: string,
    private readonly token: string,
    private readonly handlers: Handlers,
  ) {}

  start(): void {
    this.open("connecting");
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  /** Encerra de vez (sem tentar reconectar). */
  close(): void {
    this.stopped = true;
    this.stopKeepAlive();
    this.socket?.close();
    this.handlers.onStatus("closed");
  }

  private open(status: ConnectionStatus): void {
    this.handlers.onStatus(status);
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const url = `${scheme}://${location.host}/api/match/${this.matchId}/ws?token=${encodeURIComponent(this.token)}`;
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.droppedAt = null;
      this.handlers.onStatus("open");
      this.stopKeepAlive();
      this.keepAlive = setInterval(() => this.send({ type: "ping", t: Date.now() }), KEEPALIVE_MS);
    });

    socket.addEventListener("message", (event) => {
      try {
        this.handlers.onMessage(JSON.parse(String(event.data)) as ServerMessage);
      } catch {
        // mensagem ilegível: ignora
      }
    });

    socket.addEventListener("close", (event) => {
      this.stopKeepAlive();
      if (this.stopped || this.socket !== socket) return;
      // 4001: a tolerância acabou; 4000: outra aba assumiu a conexão. Não adianta tentar.
      if (event.code === 4001 || event.code === 4000) {
        this.stopped = true;
        this.handlers.onStatus("closed");
        return;
      }
      this.droppedAt ??= Date.now();
      if (Date.now() - this.droppedAt > GIVE_UP_AFTER_MS) {
        this.stopped = true;
        this.handlers.onStatus("closed");
        return;
      }
      this.handlers.onStatus("reconnecting");
      setTimeout(() => {
        if (!this.stopped) this.open("reconnecting");
      }, RETRY_MS);
    });
  }

  private stopKeepAlive(): void {
    if (this.keepAlive) clearInterval(this.keepAlive);
    this.keepAlive = null;
  }
}
