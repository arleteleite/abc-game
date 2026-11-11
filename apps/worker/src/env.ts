import type { LobbyObject } from "./LobbyObject";
import type { MatchObject } from "./MatchObject";
import type { QuizObject } from "./QuizObject";

// Recursos da Cloudflare ligados ao Worker (ver wrangler.jsonc).
export interface Env {
  LOBBY: DurableObjectNamespace<LobbyObject>;
  MATCH: DurableObjectNamespace<MatchObject>;
  QUIZ: DurableObjectNamespace<QuizObject>;
  DB: D1Database;
}
