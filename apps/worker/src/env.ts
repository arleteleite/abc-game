import type { LobbyObject } from "./LobbyObject";
import type { MatchObject } from "./MatchObject";

// Recursos da Cloudflare ligados ao Worker (ver wrangler.jsonc).
export interface Env {
  LOBBY: DurableObjectNamespace<LobbyObject>;
  MATCH: DurableObjectNamespace<MatchObject>;
  DB: D1Database;
}
